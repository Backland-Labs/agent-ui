import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../../../../../db/schema";
import { handleGetThreads, handlePostThread } from "../route";

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

async function createTestDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

async function seedAgent(db: TestDb, overrides: Partial<schema.Agent> = {}) {
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

async function seedThread(db: TestDb, agentId: string, overrides: Partial<schema.Thread> = {}) {
  const thread = {
    id: crypto.randomUUID(),
    agent_id: agentId,
    title: "Test Thread",
    status: "active" as const,
    last_activity_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
  await db.insert(schema.threads).values(thread);
  return thread;
}

async function seedMessage(db: TestDb, threadId: string, overrides: Partial<schema.Message> = {}) {
  const message = {
    id: crypto.randomUUID(),
    thread_id: threadId,
    role: "user" as const,
    content: "Hello",
    created_at: new Date(),
    ...overrides,
  };
  await db.insert(schema.messages).values(message);
  return message;
}

describe("GET /api/threads", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("returns all threads with agent info and last message (InboxThread shape)", async () => {
    const agent = await seedAgent(db);
    const thread = await seedThread(db, agent.id, { title: "My Thread" });
    await seedMessage(db, thread.id, {
      role: "assistant",
      content: "Hi there!",
      created_at: new Date("2025-01-01T00:00:00Z"),
    });

    const response = await handleGetThreads(db);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      id: thread.id,
      agent_id: agent.id,
      title: "My Thread",
      status: "active",
      agent_name: "Mock Assistant",
      agent_icon: "bot",
      last_message: "Hi there!",
      last_message_role: "assistant",
    });
    // Verify InboxThread shape keys are present
    expect(data[0]).toHaveProperty("last_activity_at");
    expect(data[0]).toHaveProperty("created_at");
    expect(data[0]).toHaveProperty("last_message_at");
  });

  it("filters threads by agent_id when ?agent= param is provided", async () => {
    const agent1 = await seedAgent(db, {
      id: "mock-assistant",
      name: "Mock Assistant",
    });
    const agent2 = await seedAgent(db, {
      id: "other-agent",
      name: "Other Agent",
      endpoint_url: "http://localhost:3000/api/other",
    });

    await seedThread(db, agent1.id, { title: "Thread A" });
    await seedThread(db, agent2.id, { title: "Thread B" });

    const response = await handleGetThreads(db, "mock-assistant");
    const data = await response.json();

    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Thread A");
    expect(data[0].agent_id).toBe("mock-assistant");
  });

  it("returns threads ordered by last_activity_at desc", async () => {
    const agent = await seedAgent(db);

    await seedThread(db, agent.id, {
      title: "Oldest",
      last_activity_at: new Date("2025-01-01T00:00:00Z"),
    });
    await seedThread(db, agent.id, {
      title: "Newest",
      last_activity_at: new Date("2025-03-01T00:00:00Z"),
    });
    await seedThread(db, agent.id, {
      title: "Middle",
      last_activity_at: new Date("2025-02-01T00:00:00Z"),
    });

    const response = await handleGetThreads(db);
    const data = await response.json();

    expect(data).toHaveLength(3);
    expect(data[0].title).toBe("Newest");
    expect(data[1].title).toBe("Middle");
    expect(data[2].title).toBe("Oldest");
  });
});

describe("POST /api/threads", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("creates a new thread and returns it", async () => {
    const agent = await seedAgent(db);

    const response = await handlePostThread(db, {
      agentId: agent.id,
      title: "New Thread",
    });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toMatchObject({
      agent_id: agent.id,
      title: "New Thread",
      status: "active",
    });
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("created_at");
  });

  it("returns 400 if agentId is missing", async () => {
    const response = await handlePostThread(db, {} as { agentId: string });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty("error");
  });

  it("returns 404 if agent does not exist in DB", async () => {
    const response = await handlePostThread(db, {
      agentId: "non-existent-agent",
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toHaveProperty("error");
  });
});
