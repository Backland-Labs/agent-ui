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

const loadRoute = async () => {
  vi.resetModules();
  return import("../route");
};

describe("GET /api/threads wrappers", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET reads query params and returns filtered threads from default db", async () => {
    const agent = await seedAgent(testDb);
    await seedThread(testDb, agent.id, { title: "Thread A" });
    await seedThread(testDb, agent.id, {
      title: "Thread B",
      id: "thread-b",
    });

    const { GET } = await loadRoute();
    const response = await GET(
      new NextRequest("http://localhost:3000/api/threads?agent=mock-assistant")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data.map((row: { title: string }) => row.title)).toEqual(
      expect.arrayContaining(["Thread A", "Thread B"])
    );
  });

  it("GET without agent query returns all threads from default db", async () => {
    const agent = await seedAgent(testDb);
    await seedThread(testDb, agent.id, { title: "Thread A" });
    await seedThread(testDb, agent.id, { title: "Thread B" });

    const { GET } = await loadRoute();
    const response = await GET(new NextRequest("http://localhost:3000/api/threads"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data.map((row: { title: string }) => row.title)).toEqual(
      expect.arrayContaining(["Thread A", "Thread B"])
    );
  });

  it("POST parses request JSON and creates thread in default db", async () => {
    const agent = await seedAgent(testDb);

    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest("http://localhost:3000/api/threads", {
        method: "POST",
        body: JSON.stringify({
          agentId: agent.id,
          title: "Posted Thread",
        }),
        headers: { "Content-Type": "application/json" },
      })
    );
    const data = await response.json();

    const rows = await testDb
      .select()
      .from(schema.threads)
      .where(eq(schema.threads.agent_id, agent.id));
    expect(response.status).toBe(201);
    expect(data.title).toBe("Posted Thread");
    expect(rows).toHaveLength(1);
  });
});
