import { describe, expect, it, vi } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../schema";

const loadAgentsConfigMock = vi.fn();

vi.mock("@/lib/agents", () => ({
  loadAgentsConfig: loadAgentsConfigMock,
}));

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

async function createTestDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

describe("syncAgentsToDb nullish branches", () => {
  it("writes nulls for missing nullable fields on insert and update", async () => {
    loadAgentsConfigMock.mockReturnValueOnce([
      {
        id: "agent-nullish",
        name: "Agent Nullish",
        endpoint_url: "http://localhost:4000/agent",
        // description intentionally omitted
      },
    ]);

    const { syncAgentsToDb } = await import("../sync-agents");
    const db = await createTestDb();

    await syncAgentsToDb(db);
    const inserted = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, "agent-nullish"));
    expect(inserted[0]).toMatchObject({
      description: null,
      icon: null,
    });

    loadAgentsConfigMock.mockReturnValueOnce([
      {
        id: "agent-nullish",
        name: "Agent Nullish Updated",
        endpoint_url: "http://localhost:4001/agent",
      },
    ]);

    await syncAgentsToDb(db);
    const updated = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, "agent-nullish"));

    expect(updated[0].description).toBeNull();
    expect(updated[0].name).toBe("Agent Nullish Updated");
    expect(updated[0].endpoint_url).toBe("http://localhost:4001/agent");
  });
});
