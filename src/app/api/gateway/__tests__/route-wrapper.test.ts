import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import * as schema from "../../../../../db/schema";

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

let testDb: TestDb;

vi.mock("../../../../../db/client", () => ({
  get db() {
    return testDb;
  },
}));

async function createTestDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

async function seedAgent(db: TestDb, overrides: Partial<typeof schema.agents.$inferInsert> = {}) {
  const agent = {
    id: "mock-assistant",
    name: "Mock Assistant",
    endpoint_url: "http://localhost:3000/api/mock-agent",
    icon: "bot",
    description: "A mock agent",
    status: "online" as const,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
  await db.insert(schema.agents).values(agent);
  return agent;
}

async function seedThread(
  db: TestDb,
  agentId: string,
  overrides: Partial<typeof schema.threads.$inferInsert> = {}
) {
  const thread = {
    id: crypto.randomUUID(),
    agent_id: agentId,
    title: "Seeded Thread",
    status: "active" as const,
    last_activity_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
  await db.insert(schema.threads).values(thread);
  return thread;
}

function buildMockAgentSSEResponse(threadId: string, runId: string, text: string): Response {
  const messageId = `msg_${Date.now()}`;
  const events = [
    { type: "RUN_STARTED", threadId, runId },
    { type: "TEXT_MESSAGE_START", messageId, role: "assistant" },
    { type: "TEXT_MESSAGE_CONTENT", messageId, delta: text },
    { type: "TEXT_MESSAGE_END", messageId },
    { type: "RUN_FINISHED", threadId, runId },
  ];

  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

async function readSSEBody(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

const loadRoute = async () => {
  vi.resetModules();
  return import("../route");
};

describe("POST /api/gateway wrappers", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POST delegates to handleGatewayPost using default db", async () => {
    const agent = await seedAgent(testDb);
    const thread = await seedThread(testDb, agent.id);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      buildMockAgentSSEResponse(thread.id, "any-run-id", "hello")
    );

    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest("http://localhost:3000/api/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: thread.id,
          agentId: agent.id,
          message: "ping",
        }),
      })
    );

    expect(response.status).toBe(200);
    await readSSEBody(response);

    const messages = await testDb
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.thread_id, thread.id));
    expect(messages.some((message) => message.role === "user" && message.content === "ping")).toBe(
      true
    );
  });
});
