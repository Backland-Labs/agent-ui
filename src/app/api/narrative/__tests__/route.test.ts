import { describe, it, expect, beforeEach, vi } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../../../../../db/schema";
import { handleGetNarrative } from "../route";

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

async function createTestDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

async function seedEmailAgent(db: TestDb) {
  await db.insert(schema.agents).values({
    id: "email-agent",
    name: "Email Agent",
    endpoint_url: "http://email-agent.test/agent",
    status: "online" as const,
    icon: "bot",
    description: "Email inbox agent",
    created_at: new Date(),
    updated_at: new Date(),
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/narrative", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("normalizes, sorts, and limits narrative items", async () => {
    await seedEmailAgent(db);

    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          {
            thread_id: "thread-6",
            agent_name: "Email Agent",
            title: "Sixth",
            snippet: "later",
            last_activity_at: "2026-02-16T12:06:00.000Z",
          },
          {
            thread_id: "thread-2",
            title: "Second",
            snippet: "later",
            last_activity_at: "2026-02-16T12:02:00.000Z",
          },
          {
            thread_id: "thread-8",
            title: "Eighth",
            snippet: "later",
            last_activity_at: "2026-02-16T12:08:00.000Z",
          },
          {
            thread_id: "thread-4",
            title: "Fourth",
            snippet: "later",
            last_activity_at: "2026-02-16T12:04:00.000Z",
          },
          {
            thread_id: "thread-7",
            title: "Seventh",
            snippet: "later",
            last_activity_at: "2026-02-16T12:07:00.000Z",
          },
          {
            thread_id: "thread-3",
            title: "Third",
            snippet: "later",
            last_activity_at: "2026-02-16T12:03:00.000Z",
          },
          {
            thread_id: "thread-5",
            title: "Fifth",
            snippet: "later",
            last_activity_at: "2026-02-16T12:05:00.000Z",
          },
          {
            thread_id: "thread-1",
            title: "First",
            snippet: "later",
            last_activity_at: "2026-02-16T12:01:00.000Z",
          },
          {
            thread_id: "thread-9",
            title: "Ninth",
            snippet: "later",
            last_activity_at: "2026-02-16T12:09:00.000Z",
          },
        ],
      })
    );

    const response = await handleGetNarrative(db, fetcher);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledWith("http://email-agent.test/agent/narrative");
    expect(data.items).toHaveLength(7);
    expect(data.items.map((item: { threadId: string }) => item.threadId)).toEqual([
      "thread-9",
      "thread-8",
      "thread-7",
      "thread-6",
      "thread-5",
      "thread-4",
      "thread-3",
    ]);
  });

  it("drops malformed rows and applies defaults for valid rows", async () => {
    await seedEmailAgent(db);

    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          id: "thread-1",
          agent_name: "Email Agent",
          last_message_role: "unknown",
          snippet: "",
          updated_at: "not-a-date",
        },
        {
          no: "id",
        },
      ])
    );

    const response = await handleGetNarrative(db, fetcher);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({
      threadId: "thread-1",
      agentName: "Email Agent",
      title: "Untitled narrative",
      snippet: "No messages yet",
      lastMessageRole: null,
      lastActivityAt: "1970-01-01T00:00:00.000Z",
    });
  });

  it("returns empty data when all endpoint rows are invalid", async () => {
    await seedEmailAgent(db);

    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ items: [{ no: "id" }] }));

    const response = await handleGetNarrative(db, fetcher);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toEqual([]);
  });

  it("returns 502 when narrative endpoint returns non-ok response", async () => {
    await seedEmailAgent(db);

    const fetcher = vi.fn().mockResolvedValue(new Response("bad", { status: 500 }));

    const response = await handleGetNarrative(db, fetcher);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data).toMatchObject({ error: "Unable to load email narrative" });
  });

  it("returns 404 when email-agent is not configured", async () => {
    const fetcher = vi.fn();

    const response = await handleGetNarrative(db, fetcher);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toMatchObject({ error: "Email narrative source unavailable" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns 500 when response body cannot be parsed", async () => {
    await seedEmailAgent(db);

    const fetcher = vi.fn().mockResolvedValue(new Response("not-json", { status: 200 }));

    const response = await handleGetNarrative(db, fetcher);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toMatchObject({ error: "Unable to load email narrative" });
  });
});
