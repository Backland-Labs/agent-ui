import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../schema";
import { syncAgentsToDb } from "../sync-agents";
import { loadAgentsConfig } from "@/lib/agents/config";

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

async function createTestDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

describe("syncAgentsToDb", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("inserts all agents from config into the database", async () => {
    await syncAgentsToDb(db);

    const rows = await db.select().from(schema.agents);
    const config = loadAgentsConfig();

    expect(rows).toHaveLength(config.length);

    for (const agentConfig of config) {
      const match = rows.find((r) => r.id === agentConfig.id);
      expect(match).toBeDefined();
      expect(match!.name).toBe(agentConfig.name);
      expect(match!.endpoint_url).toBe(agentConfig.endpoint_url);
      expect(match!.description).toBe(agentConfig.description ?? null);
      expect(match!.icon).toBe(agentConfig.icon ?? null);
    }
  });

  it("does not create duplicates when run twice", async () => {
    await syncAgentsToDb(db);
    await syncAgentsToDb(db);

    const rows = await db.select().from(schema.agents);
    const config = loadAgentsConfig();

    expect(rows).toHaveLength(config.length);
  });

  it("updates existing agent fields on re-sync", async () => {
    const config = loadAgentsConfig();
    const firstAgent = config[0];

    // Insert an agent with a stale name
    await db.insert(schema.agents).values({
      id: firstAgent.id,
      name: "Old Name",
      endpoint_url: "http://old-url:8000",
      description: "Old description",
    });

    // Sync should update the name, endpoint_url, and description
    await syncAgentsToDb(db);

    const [updated] = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, firstAgent.id));

    expect(updated.name).toBe(firstAgent.name);
    expect(updated.endpoint_url).toBe(firstAgent.endpoint_url);
    expect(updated.description).toBe(firstAgent.description ?? null);
  });

  it("preserves status field during sync", async () => {
    const config = loadAgentsConfig();
    const firstAgent = config[0];

    // Insert an agent with a custom status
    await db.insert(schema.agents).values({
      id: firstAgent.id,
      name: firstAgent.name,
      endpoint_url: firstAgent.endpoint_url,
      status: "online",
    });

    // Sync should not overwrite status
    await syncAgentsToDb(db);

    const [agent] = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, firstAgent.id));

    expect(agent.status).toBe("online");
  });

  it("preserves last_seen_at field during sync", async () => {
    const config = loadAgentsConfig();
    const firstAgent = config[0];
    const lastSeen = 1700000000000;

    // Insert an agent with a last_seen_at value
    await db.insert(schema.agents).values({
      id: firstAgent.id,
      name: firstAgent.name,
      endpoint_url: firstAgent.endpoint_url,
      last_seen_at: lastSeen,
    });

    // Sync should not overwrite last_seen_at
    await syncAgentsToDb(db);

    const [agent] = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, firstAgent.id));

    expect(agent.last_seen_at).toBe(lastSeen);
  });

  it("updates the updated_at timestamp on re-sync", async () => {
    const config = loadAgentsConfig();
    const firstAgent = config[0];

    const oldDate = new Date("2020-01-01");

    await db.insert(schema.agents).values({
      id: firstAgent.id,
      name: firstAgent.name,
      endpoint_url: firstAgent.endpoint_url,
      updated_at: oldDate,
    });

    const before = Date.now();
    await syncAgentsToDb(db);
    const after = Date.now();

    const [agent] = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, firstAgent.id));

    expect(agent.updated_at.getTime()).toBeGreaterThanOrEqual(before);
    expect(agent.updated_at.getTime()).toBeLessThanOrEqual(after);
  });

  it("sets default timestamps on initial insert", async () => {
    const before = Date.now();
    await syncAgentsToDb(db);
    const after = Date.now();

    const rows = await db.select().from(schema.agents);

    for (const agent of rows) {
      expect(agent.created_at).toBeInstanceOf(Date);
      expect(agent.updated_at).toBeInstanceOf(Date);
      expect(agent.created_at.getTime()).toBeGreaterThanOrEqual(before);
      expect(agent.created_at.getTime()).toBeLessThanOrEqual(after);
    }
  });
});
