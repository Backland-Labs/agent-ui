import { describe, it, expect, beforeEach, vi } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../../../../../db/schema";
import { handleGatewayPost } from "../route";

// AG-UI SSE event shape
interface SSEEvent {
  type: string;
  threadId?: string;
  runId?: string;
  messageId?: string;
  role?: string;
  delta?: string;
  code?: string;
  message?: string;
  error?: string;
  [key: string]: unknown;
}

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

// Create a fresh in-memory database for each test
async function createTestDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

// Helper to read the full SSE body from a Response
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

// Helper to parse individual SSE events from the body text
function parseSSEEvents(body: string): SSEEvent[] {
  return body
    .split("\n\n")
    .filter((chunk) => chunk.startsWith("data: "))
    .map((chunk) => JSON.parse(chunk.replace("data: ", "")));
}

// Helper to extract the full text content from SSE events
function extractTextContent(events: SSEEvent[]): string {
  return events
    .filter((e) => e.type === "TEXT_MESSAGE_CONTENT")
    .map((e) => e.delta)
    .join("");
}

// Seed the DB with a test agent and thread
async function seedTestData(db: TestDb) {
  const agentId = "agent-1";
  const threadId = "thread-1";

  await db.insert(schema.agents).values({
    id: agentId,
    name: "Test Agent",
    endpoint_url: "http://localhost:9999/mock-agent",
    description: "A test agent",
    created_at: new Date(),
    updated_at: new Date(),
  });

  await db.insert(schema.threads).values({
    id: threadId,
    agent_id: agentId,
    title: "Test Thread",
    last_activity_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  });

  return { agentId, threadId };
}

// Build a mock SSE response from the mock agent
function buildMockAgentSSEResponse(threadId: string, runId: string, text: string): Response {
  const messageId = `msg_${Date.now()}`;
  const events = [
    { type: "RUN_STARTED", threadId, runId },
    { type: "TEXT_MESSAGE_START", messageId, role: "assistant" },
    { type: "TEXT_MESSAGE_CONTENT", messageId, delta: text },
    { type: "TEXT_MESSAGE_END", messageId },
    { type: "RUN_FINISHED", threadId, runId },
  ];

  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("POST /api/gateway", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    vi.restoreAllMocks();
  });

  it("returns 400 for missing required fields", async () => {
    // Missing message
    const req1 = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: "t1", agentId: "a1" }),
    });
    const res1 = await handleGatewayPost(req1, db);
    expect(res1.status).toBe(400);

    // Missing threadId
    const req2 = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: "a1", message: "hi" }),
    });
    const res2 = await handleGatewayPost(req2, db);
    expect(res2.status).toBe(400);

    // Missing agentId
    const req3 = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: "t1", message: "hi" }),
    });
    const res3 = await handleGatewayPost(req3, db);
    expect(res3.status).toBe(400);
  });

  it("returns 404 for unknown agent", async () => {
    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: "thread-1",
        agentId: "nonexistent-agent",
        message: "hello",
      }),
    });

    const res = await handleGatewayPost(req, db);
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toMatch(/agent/i);
  });

  it("accepts POST with threadId, agentId, message and returns 200 with SSE content type", async () => {
    const { agentId, threadId } = await seedTestData(db);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      buildMockAgentSSEResponse(threadId, "any-run-id", "Hi there!")
    );

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId,
        agentId,
        message: "hello",
      }),
    });

    const res = await handleGatewayPost(req, db);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");

    // Consume stream to allow background processing to complete
    await readSSEBody(res);
  });

  it("persists user message to DB before calling agent", async () => {
    const { agentId, threadId } = await seedTestData(db);

    let agentCalledWithMessages: unknown = null;
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, init) => {
      const body = JSON.parse(init?.body as string);
      agentCalledWithMessages = body.messages;
      return buildMockAgentSSEResponse(threadId, body.runId, "response");
    });

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId,
        agentId,
        message: "test user message",
      }),
    });

    const res = await handleGatewayPost(req, db);
    await readSSEBody(res);

    // Check user message was persisted in DB
    const dbMessages = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.thread_id, threadId));

    const userMessages = dbMessages.filter((m) => m.role === "user");
    expect(userMessages).toHaveLength(1);
    expect(userMessages[0].content).toBe("test user message");
    expect(userMessages[0].thread_id).toBe(threadId);

    // Check agent was called with the user message in history
    expect(agentCalledWithMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "user", content: "test user message" }),
      ])
    );
  });

  it("creates a run record with status pending", async () => {
    const { agentId, threadId } = await seedTestData(db);

    let capturedRunId: string | null = null;
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, init) => {
      const body = JSON.parse(init?.body as string);
      capturedRunId = body.runId;

      // At this point, the run should already exist in DB with pending status
      const runRecords = await db.select().from(schema.runs).where(eq(schema.runs.id, body.runId));
      expect(runRecords).toHaveLength(1);
      expect(runRecords[0].status).toBe("pending");
      expect(runRecords[0].thread_id).toBe(threadId);
      expect(runRecords[0].agent_id).toBe(agentId);

      return buildMockAgentSSEResponse(threadId, body.runId, "response");
    });

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId,
        agentId,
        message: "hello",
      }),
    });

    const res = await handleGatewayPost(req, db);
    await readSSEBody(res);

    // Verify run was created
    expect(capturedRunId).not.toBeNull();
    const allRuns = await db.select().from(schema.runs);
    expect(allRuns).toHaveLength(1);
  });

  it("streams SSE events back to client", async () => {
    const { agentId, threadId } = await seedTestData(db);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      buildMockAgentSSEResponse(threadId, "run-1", "Hello world!")
    );

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId,
        agentId,
        message: "hi",
      }),
    });

    const res = await handleGatewayPost(req, db);
    const body = await readSSEBody(res);
    const events = parseSSEEvents(body);

    // Should contain the expected AG-UI event types (USER_MESSAGE_CREATED is injected by gateway)
    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain("USER_MESSAGE_CREATED");
    expect(eventTypes).toContain("RUN_STARTED");
    expect(eventTypes).toContain("TEXT_MESSAGE_START");
    expect(eventTypes).toContain("TEXT_MESSAGE_CONTENT");
    expect(eventTypes).toContain("TEXT_MESSAGE_END");
    expect(eventTypes).toContain("RUN_FINISHED");

    // USER_MESSAGE_CREATED should be the first event
    expect(events[0].type).toBe("USER_MESSAGE_CREATED");

    // Check text content was forwarded
    const text = extractTextContent(events);
    expect(text).toBe("Hello world!");
  });

  it("persists assistant message after TEXT_MESSAGE_END", async () => {
    const { agentId, threadId } = await seedTestData(db);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      buildMockAgentSSEResponse(threadId, "run-1", "This is the assistant reply.")
    );

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId,
        agentId,
        message: "tell me something",
      }),
    });

    const res = await handleGatewayPost(req, db);
    await readSSEBody(res);

    // Check assistant message was persisted
    const dbMessages = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.thread_id, threadId));

    const assistantMessages = dbMessages.filter((m) => m.role === "assistant");
    expect(assistantMessages).toHaveLength(1);
    expect(assistantMessages[0].content).toBe("This is the assistant reply.");
    expect(assistantMessages[0].run_id).not.toBeNull();
  });

  it("updates run status through lifecycle: pending -> running -> completed", async () => {
    const { agentId, threadId } = await seedTestData(db);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      buildMockAgentSSEResponse(threadId, "run-1", "done")
    );

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId,
        agentId,
        message: "go",
      }),
    });

    const res = await handleGatewayPost(req, db);
    await readSSEBody(res);

    // After full stream, run should be completed
    const allRuns = await db.select().from(schema.runs);
    expect(allRuns).toHaveLength(1);
    expect(allRuns[0].status).toBe("completed");
    expect(allRuns[0].started_at).not.toBeNull();
    expect(allRuns[0].finished_at).not.toBeNull();
  });

  it("updates run status to failed on agent fetch error", async () => {
    const { agentId, threadId } = await seedTestData(db);

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Connection refused"));

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId,
        agentId,
        message: "go",
      }),
    });

    const res = await handleGatewayPost(req, db);
    const body = await readSSEBody(res);
    const events = parseSSEEvents(body);

    // Should emit an error event in the stream
    const errorEvent = events.find((e) => e.type === "RUN_ERROR");
    expect(errorEvent).toBeDefined();

    // Run should be marked failed in DB
    const allRuns = await db.select().from(schema.runs);
    expect(allRuns).toHaveLength(1);
    expect(allRuns[0].status).toBe("failed");
    expect(allRuns[0].error).toContain("Connection refused");
  });

  it("returns AGENT_UNREACHABLE error code on network failure", async () => {
    const { agentId, threadId } = await seedTestData(db);

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Connection refused"));

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, agentId, message: "go" }),
    });

    const res = await handleGatewayPost(req, db);
    const body = await readSSEBody(res);
    const events = parseSSEEvents(body);

    const errorEvent = events.find((e) => e.type === "RUN_ERROR");
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.code).toBe("AGENT_UNREACHABLE");
    expect(errorEvent!.message).toContain("Connection refused");
    expect(errorEvent!.threadId).toBeDefined();
    expect(errorEvent!.runId).toBeDefined();
  });

  it("returns AGENT_ERROR when agent returns non-200 status", async () => {
    const { agentId, threadId } = await seedTestData(db);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500, statusText: "Internal Server Error" })
    );

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, agentId, message: "go" }),
    });

    const res = await handleGatewayPost(req, db);
    const body = await readSSEBody(res);
    const events = parseSSEEvents(body);

    const errorEvent = events.find((e) => e.type === "RUN_ERROR");
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.code).toBe("AGENT_ERROR");
    expect(errorEvent!.message).toContain("500");

    // Run should be marked failed in DB
    const allRuns = await db.select().from(schema.runs);
    expect(allRuns).toHaveLength(1);
    expect(allRuns[0].status).toBe("failed");
  });

  it("times out and returns AGENT_TIMEOUT error after configured timeout", async () => {
    const { agentId, threadId } = await seedTestData(db);

    // Set a very short timeout for testing
    vi.stubEnv("AGENT_TIMEOUT_MS", "50");

    // Mock fetch to hang until its signal aborts (simulates a slow agent)
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }
        })
    );

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, agentId, message: "go" }),
    });

    const res = await handleGatewayPost(req, db);
    const body = await readSSEBody(res);
    const events = parseSSEEvents(body);

    const errorEvent = events.find((e) => e.type === "RUN_ERROR");
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.code).toBe("AGENT_TIMEOUT");
    expect(errorEvent!.message).toContain("timed out");

    // Run should be marked failed in DB
    const allRuns = await db.select().from(schema.runs);
    expect(allRuns).toHaveLength(1);
    expect(allRuns[0].status).toBe("failed");
    expect(allRuns[0].error).toContain("timed out");

    vi.unstubAllEnvs();
  });

  it("sends X-Run-Id header to agent endpoint", async () => {
    const { agentId, threadId } = await seedTestData(db);

    let capturedHeaders: HeadersInit | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, init) => {
      capturedHeaders = init?.headers;
      const body = JSON.parse(init?.body as string);
      return buildMockAgentSSEResponse(threadId, body.runId, "response");
    });

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, agentId, message: "hello" }),
    });

    const res = await handleGatewayPost(req, db);
    await readSSEBody(res);

    // The fetch call to the agent should include X-Run-Id header
    expect(capturedHeaders).toBeDefined();
    const headers = new Headers(capturedHeaders);
    expect(headers.get("X-Run-Id")).toBeTruthy();
  });

  it("includes X-Run-Id in response headers", async () => {
    const { agentId, threadId } = await seedTestData(db);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      buildMockAgentSSEResponse(threadId, "any-run-id", "Hi!")
    );

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, agentId, message: "hello" }),
    });

    const res = await handleGatewayPost(req, db);
    await readSSEBody(res);

    // Response should include X-Run-Id header
    const runIdHeader = res.headers.get("X-Run-Id");
    expect(runIdHeader).toBeTruthy();
    // It should be a valid UUID
    expect(runIdHeader).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("sets run status to cancelled when client disconnects", async () => {
    const { agentId, threadId } = await seedTestData(db);

    // Create an AbortController to simulate client disconnect
    const clientAbort = new AbortController();

    // Mock fetch to hang until aborted, then reject with abort error
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          // Listen for the abort signal from the gateway (which should propagate client abort)
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }
        })
    );

    // Abort the client request after a short delay
    setTimeout(() => clientAbort.abort(), 50);

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, agentId, message: "go" }),
      signal: clientAbort.signal,
    });

    const res = await handleGatewayPost(req, db);
    await readSSEBody(res);

    // Run should be marked cancelled in DB
    const allRuns = await db.select().from(schema.runs);
    expect(allRuns).toHaveLength(1);
    expect(allRuns[0].status).toBe("cancelled");
  });

  it("emits USER_MESSAGE_CREATED with the persisted message ID", async () => {
    const { agentId, threadId } = await seedTestData(db);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      buildMockAgentSSEResponse(threadId, "run-1", "reply")
    );

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, agentId, message: "hello" }),
    });

    const res = await handleGatewayPost(req, db);
    const body = await readSSEBody(res);
    const events = parseSSEEvents(body);

    const userCreated = events.find((e) => e.type === "USER_MESSAGE_CREATED");
    expect(userCreated).toBeDefined();
    expect(userCreated!.threadId).toBe(threadId);
    expect(userCreated!.messageId).toBeTruthy();

    // The messageId should match the persisted user message
    const dbMessages = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.thread_id, threadId));
    const userMsg = dbMessages.find((m) => m.role === "user");
    expect(userMsg).toBeDefined();
    expect(userCreated!.messageId).toBe(userMsg!.id);
  });

  it("updates thread last_activity_at after the run", async () => {
    const { agentId, threadId } = await seedTestData(db);

    // Record the initial last_activity_at
    const [threadBefore] = await db
      .select()
      .from(schema.threads)
      .where(eq(schema.threads.id, threadId));
    const beforeTimestamp = threadBefore.last_activity_at.getTime();

    // Small delay to ensure timestamp difference
    await new Promise((r) => setTimeout(r, 10));

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      buildMockAgentSSEResponse(threadId, "run-1", "response")
    );

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId,
        agentId,
        message: "hello",
      }),
    });

    const res = await handleGatewayPost(req, db);
    await readSSEBody(res);

    // Check thread was updated
    const [threadAfter] = await db
      .select()
      .from(schema.threads)
      .where(eq(schema.threads.id, threadId));
    expect(threadAfter.last_activity_at.getTime()).toBeGreaterThan(beforeTimestamp);
  });

  it("parses trailing SSE buffer content without trailing separator", async () => {
    const { agentId, threadId } = await seedTestData(db);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(`data: ${JSON.stringify({ type: "RUN_FINISHED", threadId, runId: "run-id" })}`, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId,
        agentId,
        message: "hello",
      }),
    });

    const res = await handleGatewayPost(req, db);
    const body = await readSSEBody(res);
    const events = parseSSEEvents(body);

    expect(events.find((event) => event.type === "RUN_FINISHED")).toBeDefined();

    const runs = await db.select().from(schema.runs);
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("completed");
  });

  it("marks run failed when the stream throws during read", async () => {
    const { agentId, threadId } = await seedTestData(db);

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "RUN_STARTED", threadId, runId: "run-id" })}\\n\\n`
          )
        );
        controller.error(new Error("stream read failure"));
      },
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId,
        agentId,
        message: "go",
      }),
    });

    const res = await handleGatewayPost(req, db);
    const bodyText = await readSSEBody(res);
    const events = parseSSEEvents(bodyText);

    const errorEvent = events.find((event) => event.type === "RUN_ERROR");
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.code).toBe("INTERNAL_ERROR");

    const allRuns = await db.select().from(schema.runs);
    expect(allRuns[0].status).toBe("failed");
    expect(allRuns[0].error).toContain("Stream interrupted");
  });

  it("uses default timeout when AGENT_TIMEOUT_MS is invalid", async () => {
    const { agentId, threadId } = await seedTestData(db);

    vi.stubEnv("AGENT_TIMEOUT_MS", "not-a-number");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      buildMockAgentSSEResponse(threadId, "run-1", "ok")
    );

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, agentId, message: "hello" }),
    });

    const res = await handleGatewayPost(req, db);
    await readSSEBody(res);

    const runs = await db.select().from(schema.runs);
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("completed");

    vi.unstubAllEnvs();
  });

  it("falls back to AGENT_UNREACHABLE unknown error when fetch rejects with non-Error", async () => {
    const { agentId, threadId } = await seedTestData(db);

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce("network fail" as unknown as Error);

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, agentId, message: "go" }),
    });

    const res = await handleGatewayPost(req, db);
    const body = await readSSEBody(res);
    const events = parseSSEEvents(body);

    const errorEvent = events.find((event) => event.type === "RUN_ERROR");
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.code).toBe("AGENT_UNREACHABLE");
    expect(errorEvent!.message).toBe("Unknown error");
  });

  it("attaches and removes client abort listener when request has signal", async () => {
    const { agentId, threadId } = await seedTestData(db);

    const controller = new AbortController();
    const addSpy = vi.spyOn(controller.signal, "addEventListener");
    const removeSpy = vi.spyOn(controller.signal, "removeEventListener");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      buildMockAgentSSEResponse(threadId, "run-1", "hello")
    );

    const req = {
      signal: controller.signal,
      json: async () => ({ threadId, agentId, message: "hello" }),
    } as unknown as Request;

    const res = await handleGatewayPost(req, db);
    await readSSEBody(res);

    expect(addSpy).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("returns AGENT_ERROR when agent response has no body", async () => {
    const { agentId, threadId } = await seedTestData(db);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 200 }));

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, agentId, message: "hello" }),
    });

    const res = await handleGatewayPost(req, db);
    const body = await readSSEBody(res);
    const events = parseSSEEvents(body);

    const errorEvent = events.find((event) => event.type === "RUN_ERROR");
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.code).toBe("AGENT_ERROR");
    expect(errorEvent!.message).toBe("Empty response from agent");
  });

  it("handles malformed SSE segments without parsing errors", async () => {
    const { agentId, threadId } = await seedTestData(db);

    const malformedBody = `not-prefixed\n\ndata: {invalid-json\n\n`;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(malformedBody, { status: 200, headers: { "Content-Type": "text/event-stream" } })
    );

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, agentId, message: "hello" }),
    });

    const res = await handleGatewayPost(req, db);
    const body = await readSSEBody(res);
    expect(body.startsWith("data: ")).toBe(true);

    const bodyText = body
      .split("\n\n")
      .filter((chunk) => chunk.startsWith("data: "))
      .map((chunk) => {
        try {
          return JSON.parse(chunk.replace("data: ", ""));
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .map((event) => event.type)
      .join(",");
    expect(bodyText).toContain("USER_MESSAGE_CREATED");

    const assistantMessages = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.thread_id, threadId));
    expect(assistantMessages.filter((message) => message.role === "assistant")).toHaveLength(0);
  });

  it("handles empty SSE delta payloads and missing assistant message id", async () => {
    const { agentId, threadId } = await seedTestData(db);

    const body = [
      { type: "RUN_STARTED", threadId, runId: "run-id-empty" },
      { type: "TEXT_MESSAGE_START", role: "assistant" },
      { type: "TEXT_MESSAGE_CONTENT" },
      { type: "TEXT_MESSAGE_END" },
      { type: "RUN_FINISHED", threadId, runId: "run-id-empty" },
    ]
      .map((event) => `data: ${JSON.stringify(event)}\n\n`)
      .join("");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } })
    );

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, agentId, message: "hello" }),
    });

    const res = await handleGatewayPost(req, db);
    await readSSEBody(res);

    const assistantMessages = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.thread_id, threadId));
    expect(assistantMessages.filter((message) => message.role === "assistant")).toHaveLength(0);
  });

  it("falls back to random UUID for assistant message id when missing in START event", async () => {
    const { agentId, threadId } = await seedTestData(db);

    const generatedId = "assistant-id-fallback";
    const randomUUIDSpy = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("user-message-id")
      .mockReturnValueOnce("run-id")
      .mockReturnValueOnce(generatedId);

    const body = [
      { type: "RUN_STARTED", threadId, runId: "run-id-fallback" },
      { type: "TEXT_MESSAGE_START", role: "assistant" },
      { type: "TEXT_MESSAGE_CONTENT", delta: "Hello" },
      { type: "TEXT_MESSAGE_END", messageId: undefined },
      { type: "RUN_FINISHED", threadId, runId: "run-id-fallback" },
    ]
      .map((event) => `data: ${JSON.stringify(event)}\n\n`)
      .join("");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } })
    );

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, agentId, message: "hello" }),
    });

    const res = await handleGatewayPost(req, db);
    await readSSEBody(res);

    const assistantMessages = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.thread_id, threadId));
    const assistantMessage = assistantMessages.find((message) => message.role === "assistant");
    expect(assistantMessage?.id).toBe(generatedId);

    randomUUIDSpy.mockRestore();
  });

  it("returns 400 when request JSON body is invalid", async () => {
    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json",
    });

    const res = await handleGatewayPost(req, db);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid JSON body");
  });

  it("handles already-aborted request signal as client disconnect", async () => {
    const { agentId, threadId } = await seedTestData(db);

    const abortedController = new AbortController();
    abortedController.abort();

    const req = {
      signal: abortedController.signal,
      json: async () => ({ threadId, agentId, message: "hello" }),
    } as unknown as Request;

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Should not be called"));

    const res = await handleGatewayPost(req, db);
    const body = await readSSEBody(res);
    const events = parseSSEEvents(body);

    const errorEvent = events.find((event) => event.type === "RUN_ERROR");
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.code).toBe("AGENT_TIMEOUT");
    expect(errorEvent!.message).toBe("Client disconnected");

    const allRuns = await db.select().from(schema.runs);
    expect(allRuns[0].status).toBe("cancelled");
  });

  it("skips request signal listeners when signal is missing", async () => {
    const { agentId, threadId } = await seedTestData(db);

    const body = [
      { type: "RUN_STARTED", threadId, runId: "run-no-signal" },
      { type: "RUN_FINISHED", threadId, runId: "run-no-signal" },
    ]
      .map((event) => `data: ${JSON.stringify(event)}\n\n`)
      .join("");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } })
    );

    const req = {
      json: async () => ({ threadId, agentId, message: "hello" }),
    } as unknown as Request;

    const res = await handleGatewayPost(req, db);
    await readSSEBody(res);

    const runs = await db.select().from(schema.runs);
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("completed");
  });

  it("ignores final trailing non-SSE buffer while parsing stream", async () => {
    const { agentId, threadId } = await seedTestData(db);

    const body = `data: ${JSON.stringify({ type: "RUN_STARTED", threadId, runId: "run-id" })}\n\nnot-sse-data`;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } })
    );

    const req = new Request("http://localhost:3000/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, agentId, message: "hello" }),
    });

    const res = await handleGatewayPost(req, db);
    const bodyText = await readSSEBody(res);

    const events = bodyText
      .split("\n\n")
      .filter((chunk) => chunk.startsWith("data: "))
      .map((chunk) => {
        try {
          return JSON.parse(chunk.replace("data: ", ""));
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .map((event) => event.type);

    expect(events.some((eventType) => eventType === "RUN_STARTED")).toBe(true);
  });

  it("handles fetch failures as AGENT_UNREACHABLE when signal is missing", async () => {
    const { agentId, threadId } = await seedTestData(db);

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network down"));

    const req = {
      json: async () => ({ threadId, agentId, message: "hello" }),
    } as unknown as Request;

    const res = await handleGatewayPost(req, db);
    const body = await readSSEBody(res);
    const events = parseSSEEvents(body);

    const errorEvent = events.find((event) => event.type === "RUN_ERROR");
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.code).toBe("AGENT_UNREACHABLE");

    const runs = await db.select().from(schema.runs);
    expect(runs[0].status).toBe("failed");
  });
});
