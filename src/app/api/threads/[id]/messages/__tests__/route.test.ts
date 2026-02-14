import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../../../../../../../db/schema";
import { handleGetMessages } from "../route";

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

async function createTestDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

async function seedAgent(db: TestDb) {
  const agent = {
    id: "mock-assistant",
    name: "Mock Assistant",
    endpoint_url: "http://localhost:3000/api/mock-agent",
    icon: "bot",
    description: "A mock agent",
    status: "online" as const,
    created_at: new Date(),
    updated_at: new Date(),
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

async function seedMessage(
  db: TestDb,
  threadId: string,
  overrides: Partial<typeof schema.messages.$inferInsert> = {}
) {
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

describe("GET /api/threads/:id/messages", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("returns messages for a thread ordered by created_at asc", async () => {
    const agent = await seedAgent(db);
    const thread = await seedThread(db, agent.id);

    const msg1 = await seedMessage(db, thread.id, {
      content: "First message",
      role: "user",
      created_at: new Date("2025-01-01T00:00:00Z"),
    });
    await seedMessage(db, thread.id, {
      content: "Second message",
      role: "assistant",
      created_at: new Date("2025-01-01T01:00:00Z"),
    });
    await seedMessage(db, thread.id, {
      content: "Third message",
      role: "user",
      created_at: new Date("2025-01-01T02:00:00Z"),
    });

    const response = await handleGetMessages(db, thread.id);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(3);
    expect(data[0].content).toBe("First message");
    expect(data[1].content).toBe("Second message");
    expect(data[2].content).toBe("Third message");
    // Verify message shape
    expect(data[0]).toMatchObject({
      id: msg1.id,
      thread_id: thread.id,
      role: "user",
      content: "First message",
    });
  });

  it("returns empty array for thread with no messages", async () => {
    const agent = await seedAgent(db);
    const thread = await seedThread(db, agent.id);

    const response = await handleGetMessages(db, thread.id);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });

  it("returns 404 for non-existent thread", async () => {
    const response = await handleGetMessages(db, "non-existent-id");
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toHaveProperty("error");
  });
});
