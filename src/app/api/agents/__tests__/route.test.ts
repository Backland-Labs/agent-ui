import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../../../../../db/schema";
import { eq } from "drizzle-orm";

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

const loadRoute = async () => {
  vi.resetModules();
  return import("../route");
};

describe("GET /api/agents", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns all agents from default db", async () => {
    await testDb.insert(schema.agents).values([
      {
        id: "agent-1",
        name: "Agent One",
        endpoint_url: "http://localhost:3001/agent",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: "agent-2",
        name: "Agent Two",
        endpoint_url: "http://localhost:3002/agent",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    const { GET } = await loadRoute();
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data.map((row: { id: string }) => row.id)).toEqual(
      expect.arrayContaining(["agent-1", "agent-2"])
    );
  });
});
