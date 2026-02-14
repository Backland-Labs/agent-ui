import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import * as schema from "../../../../../../../db/schema";

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

let testDb: TestDb;

vi.mock("../../../../../../../db/client", () => ({
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

async function seedMessage(db: TestDb, threadId: string) {
  await db.insert(schema.messages).values({
    id: crypto.randomUUID(),
    thread_id: threadId,
    role: "user",
    content: "Hello",
    created_at: new Date(),
  });
}

const loadRoute = async () => {
  vi.resetModules();
  return import("../route");
};

describe("GET /api/threads/[id]/messages wrappers", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET uses default db and returns messages for the thread", async () => {
    const agent = await seedAgent(testDb);
    const thread = await seedThread(testDb, agent.id);
    await seedMessage(testDb, thread.id);

    const { GET } = await loadRoute();
    const response = await GET(
      new NextRequest(`http://localhost:3000/api/threads/${thread.id}/messages`),
      { params: Promise.resolve({ id: thread.id }) }
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].role).toBe("user");

    const threadRows = await testDb
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.thread_id, thread.id));
    expect(threadRows).toHaveLength(1);
  });
});
