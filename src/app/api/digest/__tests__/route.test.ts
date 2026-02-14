import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../../../../../db/schema";
import { handleGetDigest } from "../route";

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

async function createTestDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

async function seedAgent(db: TestDb, overrides: Partial<typeof schema.agents.$inferInsert> = {}) {
  const agent = {
    id: "agent-1",
    name: "Agent One",
    endpoint_url: "http://localhost:3000/api/mock-agent",
    status: "online" as const,
    icon: "bot",
    description: "A mock agent",
    created_at: new Date("2026-02-14T00:00:00.000Z"),
    updated_at: new Date("2026-02-14T00:00:00.000Z"),
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
    title: "Morning Update",
    status: "active" as const,
    last_activity_at: new Date("2026-02-14T11:00:00.000Z"),
    created_at: new Date("2026-02-14T11:00:00.000Z"),
    updated_at: new Date("2026-02-14T11:00:00.000Z"),
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
    role: "assistant" as const,
    content: "Draft ready",
    created_at: new Date("2026-02-14T11:10:00.000Z"),
    ...overrides,
  };

  await db.insert(schema.messages).values(message);
  return message;
}

async function seedRun(
  db: TestDb,
  threadId: string,
  overrides: Partial<typeof schema.runs.$inferInsert> = {}
) {
  const run = {
    id: crypto.randomUUID(),
    thread_id: threadId,
    agent_id: "agent-1",
    status: "pending" as const,
    created_at: new Date("2026-02-14T11:30:00.000Z"),
    ...overrides,
  };

  await db.insert(schema.runs).values(run);
  return run;
}

describe("GET /api/digest", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("returns concise digest payload for recent activity", async () => {
    const agent = await seedAgent(db);
    const thread = await seedThread(db, agent.id);
    await seedMessage(db, thread.id, {
      content: "Draft review is ready.",
      created_at: new Date("2026-02-14T11:20:00.000Z"),
    });
    await seedRun(db, thread.id);

    const response = await handleGetDigest(db, new Date("2026-02-14T12:00:00.000Z"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "new_threads", value: 1 }),
        expect.objectContaining({ key: "active_runs", value: 1 }),
        expect.objectContaining({ key: "agent_replies", value: 1 }),
      ])
    );
    expect(data.topItems).toHaveLength(1);
    expect(data.topItems[0]).toMatchObject({
      subject: "Morning Update",
      agentName: "Agent One",
      snippet: "Draft review is ready.",
    });
    expect(data.agentRollups).toHaveLength(1);
    expect(data.agentRollups[0]).toMatchObject({
      agentId: "agent-1",
      newThreads: 1,
      agentReplies: 1,
    });
  });

  it("returns empty-but-valid payload when there is no recent activity", async () => {
    const response = await handleGetDigest(db, new Date("2026-02-14T12:00:00.000Z"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "new_threads", value: 0 }),
        expect.objectContaining({ key: "active_runs", value: 0 }),
        expect.objectContaining({ key: "agent_replies", value: 0 }),
      ])
    );
    expect(data.topItems).toEqual([]);
    expect(data.agentRollups).toEqual([]);
  });

  it("returns 500 and sanitized error on query failure", async () => {
    const throwingDb = {
      select: () => {
        throw new Error("query failure");
      },
    };

    const response = await handleGetDigest(throwingDb as unknown as never);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toMatchObject({ error: "Unable to load digest" });
  });
});
