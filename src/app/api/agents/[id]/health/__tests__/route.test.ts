import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../../../../../../../db/schema";
import { handleHealthCheck } from "../route";

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

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
    endpoint_url: "http://localhost:9999/api/agent",
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

describe("GET /api/agents/:id/health", () => {
  let db: TestDb;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    db = await createTestDb();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 404 for unknown agent", async () => {
    const response = await handleHealthCheck("non-existent-id", db);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toHaveProperty("error");
  });

  it("returns online status when agent endpoint is reachable", async () => {
    const agent = await seedAgent(db);
    fetchSpy.mockResolvedValueOnce(new Response("OK", { status: 200 }));

    const response = await handleHealthCheck(agent.id, db);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.agentId).toBe(agent.id);
    expect(data.status).toBe("online");
    expect(data.lastSeenAt).toBeDefined();
  });

  it("returns offline status when agent endpoint is unreachable", async () => {
    const agent = await seedAgent(db);
    fetchSpy.mockRejectedValueOnce(new Error("Connection refused"));

    const response = await handleHealthCheck(agent.id, db);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.agentId).toBe(agent.id);
    expect(data.status).toBe("offline");
  });

  it("returns offline status when agent endpoint times out", async () => {
    const agent = await seedAgent(db);
    // Mock fetch to never resolve (simulating a timeout)
    fetchSpy.mockImplementationOnce(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error("AbortError")), 100))
    );

    const response = await handleHealthCheck(agent.id, db, { timeoutMs: 50 });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.agentId).toBe(agent.id);
    expect(data.status).toBe("offline");
  });

  it("updates agent status and last_seen_at in DB", async () => {
    const agent = await seedAgent(db, { status: "unknown", last_seen_at: null });
    fetchSpy.mockResolvedValueOnce(new Response("OK", { status: 200 }));

    await handleHealthCheck(agent.id, db);

    const updated = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, agent.id))
      .get();

    expect(updated).toBeDefined();
    expect(updated!.status).toBe("online");
    expect(updated!.last_seen_at).toBeGreaterThan(0);
  });

  it("preserves existing agent data when updating status", async () => {
    const agent = await seedAgent(db, {
      name: "My Custom Agent",
      description: "Special description",
      icon: "star",
      config: JSON.stringify({ key: "value" }),
    });
    fetchSpy.mockResolvedValueOnce(new Response("OK", { status: 200 }));

    await handleHealthCheck(agent.id, db);

    const updated = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, agent.id))
      .get();

    expect(updated).toBeDefined();
    expect(updated!.name).toBe("My Custom Agent");
    expect(updated!.description).toBe("Special description");
    expect(updated!.icon).toBe("star");
    expect(updated!.endpoint_url).toBe("http://localhost:9999/api/agent");
    expect(updated!.status).toBe("online");
  });
});
