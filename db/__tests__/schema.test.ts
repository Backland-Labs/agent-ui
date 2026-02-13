import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq, sql } from "drizzle-orm";
import * as schema from "../schema";

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

async function createTestDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

describe("schema — table creation", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("creates the agents table", async () => {
    const result = await db.select().from(schema.agents);
    expect(result).toEqual([]);
  });

  it("creates the threads table", async () => {
    const result = await db.select().from(schema.threads);
    expect(result).toEqual([]);
  });

  it("creates the messages table", async () => {
    const result = await db.select().from(schema.messages);
    expect(result).toEqual([]);
  });

  it("creates the runs table", async () => {
    const result = await db.select().from(schema.runs);
    expect(result).toEqual([]);
  });
});

describe("schema — agents table", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("can insert and select an agent with all fields", async () => {
    const now = new Date();

    await db.insert(schema.agents).values({
      id: "agent-1",
      name: "Test Agent",
      endpoint_url: "http://localhost:8000/agent",
      icon: "bot",
      description: "A test agent",
      status: "online",
      last_seen_at: 1000,
      config: { key: "value" },
      created_at: now,
      updated_at: now,
    });

    const rows = await db.select().from(schema.agents);
    expect(rows).toHaveLength(1);

    const agent = rows[0];
    expect(agent.id).toBe("agent-1");
    expect(agent.name).toBe("Test Agent");
    expect(agent.endpoint_url).toBe("http://localhost:8000/agent");
    expect(agent.icon).toBe("bot");
    expect(agent.description).toBe("A test agent");
    expect(agent.status).toBe("online");
    expect(agent.last_seen_at).toBe(1000);
    expect(agent.config).toEqual({ key: "value" });
    expect(agent.created_at).toEqual(now);
    expect(agent.updated_at).toEqual(now);
  });

  it("applies default status of 'unknown'", async () => {
    await db.insert(schema.agents).values({
      id: "agent-defaults",
      name: "Default Agent",
      endpoint_url: "http://localhost:8000",
    });

    const [agent] = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, "agent-defaults"));

    expect(agent.status).toBe("unknown");
  });

  it("applies default created_at and updated_at timestamps", async () => {
    const before = Date.now();

    await db.insert(schema.agents).values({
      id: "agent-ts",
      name: "Timestamp Agent",
      endpoint_url: "http://localhost:8000",
    });

    const after = Date.now();

    const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.id, "agent-ts"));

    expect(agent.created_at).toBeInstanceOf(Date);
    expect(agent.updated_at).toBeInstanceOf(Date);
    expect(agent.created_at.getTime()).toBeGreaterThanOrEqual(before);
    expect(agent.created_at.getTime()).toBeLessThanOrEqual(after);
    expect(agent.updated_at.getTime()).toBeGreaterThanOrEqual(before);
    expect(agent.updated_at.getTime()).toBeLessThanOrEqual(after);
  });

  it("allows nullable fields to be null", async () => {
    await db.insert(schema.agents).values({
      id: "agent-nulls",
      name: "Null Agent",
      endpoint_url: "http://localhost:8000",
    });

    const [agent] = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, "agent-nulls"));

    expect(agent.icon).toBeNull();
    expect(agent.description).toBeNull();
    expect(agent.last_seen_at).toBeNull();
    expect(agent.config).toBeNull();
  });
});

describe("schema — threads table", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    await db.insert(schema.agents).values({
      id: "agent-1",
      name: "Test Agent",
      endpoint_url: "http://localhost:8000",
    });
  });

  it("can insert a thread linked to an agent via foreign key", async () => {
    const now = new Date();

    await db.insert(schema.threads).values({
      id: "thread-1",
      agent_id: "agent-1",
      title: "Test Thread",
      status: "active",
      last_activity_at: now,
      created_at: now,
      updated_at: now,
    });

    const rows = await db.select().from(schema.threads);
    expect(rows).toHaveLength(1);

    const thread = rows[0];
    expect(thread.id).toBe("thread-1");
    expect(thread.agent_id).toBe("agent-1");
    expect(thread.title).toBe("Test Thread");
    expect(thread.status).toBe("active");
  });

  it("applies default status of 'active'", async () => {
    await db.insert(schema.threads).values({
      id: "thread-default",
      agent_id: "agent-1",
    });

    const [thread] = await db
      .select()
      .from(schema.threads)
      .where(eq(schema.threads.id, "thread-default"));

    expect(thread.status).toBe("active");
  });

  it("applies default timestamp fields", async () => {
    const before = Date.now();

    await db.insert(schema.threads).values({
      id: "thread-ts",
      agent_id: "agent-1",
    });

    const after = Date.now();

    const [thread] = await db
      .select()
      .from(schema.threads)
      .where(eq(schema.threads.id, "thread-ts"));

    expect(thread.created_at).toBeInstanceOf(Date);
    expect(thread.updated_at).toBeInstanceOf(Date);
    expect(thread.last_activity_at).toBeInstanceOf(Date);
    expect(thread.created_at.getTime()).toBeGreaterThanOrEqual(before);
    expect(thread.created_at.getTime()).toBeLessThanOrEqual(after);
  });
});

describe("schema — messages table", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    await db.insert(schema.agents).values({
      id: "agent-1",
      name: "Test Agent",
      endpoint_url: "http://localhost:8000",
    });
    await db.insert(schema.threads).values({
      id: "thread-1",
      agent_id: "agent-1",
    });
  });

  it("can insert a user message linked to a thread", async () => {
    await db.insert(schema.messages).values({
      id: "msg-1",
      thread_id: "thread-1",
      role: "user",
      content: "Hello, agent!",
    });

    const rows = await db.select().from(schema.messages);
    expect(rows).toHaveLength(1);

    const msg = rows[0];
    expect(msg.id).toBe("msg-1");
    expect(msg.thread_id).toBe("thread-1");
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("Hello, agent!");
    expect(msg.run_id).toBeNull();
    expect(msg.metadata).toBeNull();
  });

  it("can insert an assistant message with metadata", async () => {
    await db.insert(schema.messages).values({
      id: "msg-2",
      thread_id: "thread-1",
      role: "assistant",
      content: "Hello, user!",
      metadata: { model: "claude-3", tokens: 42 },
    });

    const [msg] = await db.select().from(schema.messages).where(eq(schema.messages.id, "msg-2"));

    expect(msg.role).toBe("assistant");
    expect(msg.metadata).toEqual({ model: "claude-3", tokens: 42 });
  });

  it("can insert a message linked to a run", async () => {
    await db.insert(schema.runs).values({
      id: "run-1",
      thread_id: "thread-1",
      agent_id: "agent-1",
    });

    await db.insert(schema.messages).values({
      id: "msg-3",
      thread_id: "thread-1",
      run_id: "run-1",
      role: "assistant",
      content: "Response from run",
    });

    const [msg] = await db.select().from(schema.messages).where(eq(schema.messages.id, "msg-3"));

    expect(msg.run_id).toBe("run-1");
  });

  it("applies default created_at timestamp", async () => {
    const before = Date.now();

    await db.insert(schema.messages).values({
      id: "msg-ts",
      thread_id: "thread-1",
      role: "system",
      content: "System message",
    });

    const after = Date.now();

    const [msg] = await db.select().from(schema.messages).where(eq(schema.messages.id, "msg-ts"));

    expect(msg.created_at).toBeInstanceOf(Date);
    expect(msg.created_at.getTime()).toBeGreaterThanOrEqual(before);
    expect(msg.created_at.getTime()).toBeLessThanOrEqual(after);
  });
});

describe("schema — runs table", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    await db.insert(schema.agents).values({
      id: "agent-1",
      name: "Test Agent",
      endpoint_url: "http://localhost:8000",
    });
    await db.insert(schema.threads).values({
      id: "thread-1",
      agent_id: "agent-1",
    });
  });

  it("can insert a run linked to thread and agent", async () => {
    const now = new Date();

    await db.insert(schema.runs).values({
      id: "run-1",
      thread_id: "thread-1",
      agent_id: "agent-1",
      status: "running",
      provider_run_id: "ext-123",
      metadata: { step: 1 },
      started_at: now,
      created_at: now,
    });

    const rows = await db.select().from(schema.runs);
    expect(rows).toHaveLength(1);

    const run = rows[0];
    expect(run.id).toBe("run-1");
    expect(run.thread_id).toBe("thread-1");
    expect(run.agent_id).toBe("agent-1");
    expect(run.status).toBe("running");
    expect(run.provider_run_id).toBe("ext-123");
    expect(run.metadata).toEqual({ step: 1 });
    expect(run.started_at).toEqual(now);
  });

  it("applies default status of 'pending'", async () => {
    await db.insert(schema.runs).values({
      id: "run-default",
      thread_id: "thread-1",
      agent_id: "agent-1",
    });

    const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, "run-default"));

    expect(run.status).toBe("pending");
  });

  it("applies default created_at timestamp", async () => {
    const before = Date.now();

    await db.insert(schema.runs).values({
      id: "run-ts",
      thread_id: "thread-1",
      agent_id: "agent-1",
    });

    const after = Date.now();

    const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, "run-ts"));

    expect(run.created_at).toBeInstanceOf(Date);
    expect(run.created_at.getTime()).toBeGreaterThanOrEqual(before);
    expect(run.created_at.getTime()).toBeLessThanOrEqual(after);
  });

  it("can store an error message on a failed run", async () => {
    await db.insert(schema.runs).values({
      id: "run-fail",
      thread_id: "thread-1",
      agent_id: "agent-1",
      status: "failed",
      error: "Connection timeout",
    });

    const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, "run-fail"));

    expect(run.status).toBe("failed");
    expect(run.error).toBe("Connection timeout");
  });

  it("supports run status transitions: pending -> running -> completed", async () => {
    await db.insert(schema.runs).values({
      id: "run-lifecycle",
      thread_id: "thread-1",
      agent_id: "agent-1",
    });

    // Verify initial status is pending
    let [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, "run-lifecycle"));
    expect(run.status).toBe("pending");

    // Transition to running
    const startedAt = new Date();
    await db
      .update(schema.runs)
      .set({ status: "running", started_at: startedAt })
      .where(eq(schema.runs.id, "run-lifecycle"));

    [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, "run-lifecycle"));
    expect(run.status).toBe("running");
    expect(run.started_at).toEqual(startedAt);

    // Transition to completed
    const finishedAt = new Date();
    await db
      .update(schema.runs)
      .set({ status: "completed", finished_at: finishedAt })
      .where(eq(schema.runs.id, "run-lifecycle"));

    [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, "run-lifecycle"));
    expect(run.status).toBe("completed");
    expect(run.finished_at).toEqual(finishedAt);
  });
});

describe("schema — foreign key constraints", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("rejects a thread with non-existent agent_id when foreign keys are enforced", async () => {
    // Enable SQLite foreign key enforcement (off by default in libsql)
    await db.run(sql`PRAGMA foreign_keys = ON`);

    await expect(
      db.insert(schema.threads).values({
        id: "thread-orphan",
        agent_id: "nonexistent-agent",
      })
    ).rejects.toThrow();
  });

  it("rejects a message with non-existent thread_id when foreign keys are enforced", async () => {
    await db.run(sql`PRAGMA foreign_keys = ON`);

    await expect(
      db.insert(schema.messages).values({
        id: "msg-orphan",
        thread_id: "nonexistent-thread",
        role: "user",
        content: "orphan message",
      })
    ).rejects.toThrow();
  });

  it("rejects a run with non-existent thread_id when foreign keys are enforced", async () => {
    await db.run(sql`PRAGMA foreign_keys = ON`);

    await db.insert(schema.agents).values({
      id: "agent-1",
      name: "Test Agent",
      endpoint_url: "http://localhost:8000",
    });

    await expect(
      db.insert(schema.runs).values({
        id: "run-orphan",
        thread_id: "nonexistent-thread",
        agent_id: "agent-1",
      })
    ).rejects.toThrow();
  });

  it("rejects a run with non-existent agent_id when foreign keys are enforced", async () => {
    await db.run(sql`PRAGMA foreign_keys = ON`);

    await db.insert(schema.agents).values({
      id: "agent-1",
      name: "Test Agent",
      endpoint_url: "http://localhost:8000",
    });
    await db.insert(schema.threads).values({
      id: "thread-1",
      agent_id: "agent-1",
    });

    await expect(
      db.insert(schema.runs).values({
        id: "run-orphan",
        thread_id: "thread-1",
        agent_id: "nonexistent-agent",
      })
    ).rejects.toThrow();
  });
});
