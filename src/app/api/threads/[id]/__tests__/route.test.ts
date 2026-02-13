import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../../../../../../db/schema";
import { handleGetThread } from "../route";

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

describe("GET /api/threads/:id", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("returns thread with agent info", async () => {
    const agent = await seedAgent(db);
    const thread = await seedThread(db, agent.id, { title: "My Thread" });

    const response = await handleGetThread(db, thread.id);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      id: thread.id,
      agent_id: agent.id,
      title: "My Thread",
      status: "active",
      agent_name: "Mock Assistant",
      agent_icon: "bot",
    });
    expect(data).toHaveProperty("last_activity_at");
    expect(data).toHaveProperty("created_at");
  });

  it("returns 404 for non-existent thread", async () => {
    const response = await handleGetThread(db, "non-existent-id");
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toHaveProperty("error");
  });
});
