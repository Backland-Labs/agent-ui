import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { NextRequest } from "next/server";
import * as schema from "../../../../../../db/schema";

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

let testDb: TestDb;

vi.mock("../../../../../../db/client", () => ({
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

const loadRoute = async () => {
  vi.resetModules();
  return import("../route");
};

describe("/api/threads/[id] GET wrapper", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET returns a thread from the default db when id param is present", async () => {
    const agent = await seedAgent(testDb);
    const thread = await seedThread(testDb, agent.id);

    const { GET } = await loadRoute();
    const response = await GET(new NextRequest(`http://localhost:3000/api/threads/${thread.id}`), {
      params: Promise.resolve({ id: thread.id }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      id: thread.id,
      title: "Seeded Thread",
      agent_name: "Mock Assistant",
      agent_icon: "bot",
    });
  });
});
