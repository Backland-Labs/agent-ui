import { NextRequest } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db as defaultDb } from "../../../../db/client";
import * as schema from "../../../../db/schema";

type Db = typeof defaultDb;

interface GatewayRequestBody {
  threadId: string;
  agentId: string;
  message: string;
}

interface SSEEvent {
  type: string;
  threadId?: string;
  runId?: string;
  messageId?: string;
  role?: string;
  delta?: string;
  [key: string]: unknown;
}

function sseEvent(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function parseSSEStream(text: string): SSEEvent[] {
  return text
    .split("\n\n")
    .filter((chunk) => chunk.startsWith("data: "))
    .map((chunk) => JSON.parse(chunk.replace("data: ", "")));
}

/**
 * Core gateway handler. Accepts a db instance for testability.
 *
 * POST /api/gateway
 * Body: { threadId, agentId, message }
 *
 * 1. Validate input
 * 2. Look up agent in DB to get endpoint_url
 * 3. Insert user message into messages table
 * 4. Create run record (status: pending)
 * 5. Call agent endpoint with { threadId, runId, messages: [full history] }
 * 6. Parse SSE events from agent response
 * 7. For each event, update DB and forward to client
 * 8. Return SSE stream to client
 */
export async function handleGatewayPost(req: Request, db: Db): Promise<Response> {
  // 1. Validate input
  let body: GatewayRequestBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { threadId, agentId, message } = body;

  if (!threadId || !agentId || !message) {
    return Response.json(
      { error: "Missing required fields: threadId, agentId, message" },
      { status: 400 }
    );
  }

  // 2. Look up agent in DB
  const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.id, agentId));

  if (!agent) {
    return Response.json({ error: `Agent not found: ${agentId}` }, { status: 404 });
  }

  // 3. Insert user message into messages table
  const userMessageId = crypto.randomUUID();
  await db.insert(schema.messages).values({
    id: userMessageId,
    thread_id: threadId,
    role: "user",
    content: message,
    created_at: new Date(),
  });

  // 4. Create run record (status: pending)
  const runId = crypto.randomUUID();
  await db.insert(schema.runs).values({
    id: runId,
    thread_id: threadId,
    agent_id: agentId,
    status: "pending",
    created_at: new Date(),
  });

  // 5. Fetch full message history for the thread
  const messageHistory = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.thread_id, threadId))
    .orderBy(asc(schema.messages.created_at));

  const messagesForAgent = messageHistory.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // 6. Call agent endpoint
  let agentResponse: Response;
  try {
    agentResponse = await fetch(agent.endpoint_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId,
        runId,
        messages: messagesForAgent,
      }),
    });
  } catch (error: unknown) {
    // Agent call failed - update run to failed status
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await db
      .update(schema.runs)
      .set({
        status: "failed",
        error: errorMessage,
        finished_at: new Date(),
      })
      .where(eq(schema.runs.id, runId));

    // Return an SSE stream with the error event
    const errorBody = sseEvent({
      type: "RUN_ERROR",
      threadId,
      runId,
      error: errorMessage,
    });

    return new Response(errorBody, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  // 7. Parse agent SSE response and process events
  const agentBody = await agentResponse.text();
  const events = parseSSEStream(agentBody);

  let assistantContent = "";
  let assistantMessageId: string | null = null;

  for (const event of events) {
    switch (event.type) {
      case "RUN_STARTED":
        await db
          .update(schema.runs)
          .set({ status: "running", started_at: new Date() })
          .where(eq(schema.runs.id, runId));
        break;

      case "TEXT_MESSAGE_START":
        assistantMessageId = (event.messageId as string) || null;
        break;

      case "TEXT_MESSAGE_CONTENT":
        assistantContent += event.delta || "";
        break;

      case "TEXT_MESSAGE_END":
        // Persist assistant message
        if (assistantContent) {
          await db.insert(schema.messages).values({
            id: assistantMessageId || crypto.randomUUID(),
            thread_id: threadId,
            run_id: runId,
            role: "assistant",
            content: assistantContent,
            created_at: new Date(),
          });
        }
        break;

      case "RUN_FINISHED":
        await db
          .update(schema.runs)
          .set({ status: "completed", finished_at: new Date() })
          .where(eq(schema.runs.id, runId));
        break;
    }
  }

  // 8. Update thread last_activity_at
  await db
    .update(schema.threads)
    .set({ last_activity_at: new Date(), updated_at: new Date() })
    .where(eq(schema.threads.id, threadId));

  // 9. Forward all events to the client as SSE
  const sseBody = events.map((e) => sseEvent(e)).join("");

  return new Response(sseBody, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * Next.js route handler — uses the default database from db/client.ts.
 */
export async function POST(req: NextRequest) {
  return handleGatewayPost(req, defaultDb);
}
