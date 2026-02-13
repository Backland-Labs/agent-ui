import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
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
    id: "test-agent",
    name: "Test Agent",
    endpoint_url: "http://localhost:3000/api/agent",
    icon: "bot",
    description: "A test agent",
    status: "unknown" as const,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
  await db.insert(schema.agents).values(agent);
  return agent;
}

const loadRoute = async () => {
  vi.resetModules();
  return import("../route");
};

describe("GET /api/agents/:id/health wrapper", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("OK", { status: 200 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts params and returns health from default db", async () => {
    const agent = await seedAgent(testDb);
    const { GET } = await loadRoute();

    const response = await GET(
      new NextRequest(`http://localhost:3000/api/agents/${agent.id}/health`),
      {
        params: Promise.resolve({ id: agent.id }),
      }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.agentId).toBe(agent.id);
    expect(data.status).toBe("online");
  });
});
