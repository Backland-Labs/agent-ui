import { describe, it, expect, beforeEach, vi } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../../../../../db/schema";
import {
  handleGetNarrative,
  resetNarrativeCacheForTests,
  shouldBypassNarrativeCache,
} from "../route";

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

async function createTestDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

async function seedEmailAgent(db: TestDb, endpointUrl = "http://email-agent.test/agent") {
  await db.insert(schema.agents).values({
    id: "email-agent",
    name: "Email Agent",
    endpoint_url: endpointUrl,
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
    resetNarrativeCacheForTests();
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
    expect(fetcher).toHaveBeenCalledWith("http://email-agent.test/narrative", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{}",
    });
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
    expect(data.narrative).toBe("");
    expect(data.actionItems).toEqual([]);
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
    expect(data.narrative).toBe("");
    expect(data.actionItems).toEqual([]);
  });

  it("returns empty data when all endpoint rows are invalid", async () => {
    await seedEmailAgent(db);

    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ items: [{ no: "id" }] }));

    const response = await handleGetNarrative(db, fetcher);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toEqual([]);
    expect(data.narrative).toBe("");
    expect(data.actionItems).toEqual([]);
  });

  it("extracts item payloads from SSE response data", async () => {
    await seedEmailAgent(db);

    const body = [
      'event: RUN_STARTED\ndata: {"type":"RUN_STARTED","runId":"run-1"}',
      [
        "event: RUN_FINISHED",
        [
          'data: {"type":"RUN_FINISHED","result":{"items":[{"thread_id":"thread-2","agent_name":"Email Agent","title":"Second","snippet":"later","last_activity_at":"2026-02-16T12:02:00.000Z"},{"thread_id":"thread-1","agent_name":"Email Agent","title":"First","snippet":"earlier","last_activity_at":"2026-02-16T12:01:00.000Z"}],"narrative":"Summary from run result","actionItems":["Reply to organizer"]}}',
        ].join("\n"),
      ].join("\n"),
    ].join("\n\n");

    const fetcher = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );

    const response = await handleGetNarrative(db, fetcher);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items.map((item: { threadId: string }) => item.threadId)).toEqual([
      "thread-2",
      "thread-1",
    ]);
    expect(data.narrative).toBe("Summary from run result");
    expect(data.actionItems).toEqual(["Reply to organizer"]);
  });

  it("extracts narrative and action items from SSE when no items are returned", async () => {
    await seedEmailAgent(db);

    const body = [
      'data: {"type":"RUN_STARTED","runId":"run-2"}',
      [
        'data: {"type":"TEXT_MESSAGE_CONTENT","delta":"# 48h Inbox Narrative"}',
        'data: {"type":"TEXT_MESSAGE_CONTENT","delta":"\\n\\n- Reviewed 5 unread emails"}',
      ].join("\n\n"),
      [
        "event: RUN_FINISHED",
        [
          'data: {"type":"RUN_FINISHED","result":{"narrative":"# 48h Inbox Narrative\\n\\n- Reviewed 5 unread emails","actionItems":["Reply to sponsor"]}}',
        ].join("\n"),
      ].join("\n"),
    ].join("\n\n");

    const fetcher = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );

    const response = await handleGetNarrative(db, fetcher);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toEqual([]);
    expect(data.narrative).toBe("# 48h Inbox Narrative\n\n- Reviewed 5 unread emails");
    expect(data.actionItems).toEqual(["Reply to sponsor"]);
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

  it("returns empty data when response body cannot be parsed", async () => {
    await seedEmailAgent(db);

    const fetcher = vi.fn().mockResolvedValue(new Response("not-json", { status: 200 }));

    const response = await handleGetNarrative(db, fetcher);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toEqual([]);
    expect(data.narrative).toBe("");
    expect(data.actionItems).toEqual([]);
  });

  it("reuses cached successful response for repeated requests within TTL", async () => {
    await seedEmailAgent(db);

    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [
          {
            thread_id: "thread-1",
            title: "First",
            snippet: "cached",
            last_activity_at: "2026-02-16T12:01:00.000Z",
          },
        ],
        narrative: "Cached narrative",
        actionItems: ["Reply to thread-1"],
      })
    );

    const firstResponse = await handleGetNarrative(db, fetcher, { nowMs: 1_000 });
    const firstData = await firstResponse.json();
    const secondResponse = await handleGetNarrative(db, fetcher, { nowMs: 1_500 });
    const secondData = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(secondData).toEqual(firstData);
  });

  it("treats cache entry as expired when age reaches TTL boundary", async () => {
    await seedEmailAgent(db);

    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              thread_id: "thread-a",
              title: "First",
              snippet: "first",
              last_activity_at: "2026-02-16T12:01:00.000Z",
            },
          ],
          narrative: "Summary A",
          actionItems: [],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              thread_id: "thread-b",
              title: "Second",
              snippet: "second",
              last_activity_at: "2026-02-16T12:02:00.000Z",
            },
          ],
          narrative: "Summary B",
          actionItems: ["Reply to thread-b"],
        })
      );

    await handleGetNarrative(db, fetcher, { nowMs: 10_000 });
    const response = await handleGetNarrative(db, fetcher, { nowMs: 70_000 });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(data.items[0]).toMatchObject({ threadId: "thread-b" });
    expect(data.narrative).toBe("Summary B");
    expect(data.actionItems).toEqual(["Reply to thread-b"]);
  });

  it("bypasses cache and refreshes stored payload when requested", async () => {
    await seedEmailAgent(db);

    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              thread_id: "thread-old",
              title: "Old",
              snippet: "old",
              last_activity_at: "2026-02-16T12:01:00.000Z",
            },
          ],
          narrative: "Summary old",
          actionItems: [],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              thread_id: "thread-new",
              title: "New",
              snippet: "new",
              last_activity_at: "2026-02-16T12:02:00.000Z",
            },
          ],
          narrative: "Summary new",
          actionItems: ["Reply to thread-new"],
        })
      );

    await handleGetNarrative(db, fetcher, { nowMs: 1_000 });

    const bypassResponse = await handleGetNarrative(db, fetcher, {
      bypassCache: true,
      nowMs: 1_500,
    });
    const bypassData = await bypassResponse.json();

    const cachedResponse = await handleGetNarrative(db, fetcher, { nowMs: 2_000 });
    const cachedData = await cachedResponse.json();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(bypassData.items[0]).toMatchObject({ threadId: "thread-new" });
    expect(cachedData.items[0]).toMatchObject({ threadId: "thread-new" });
  });

  it("keeps prior cached success when bypass refresh fails", async () => {
    await seedEmailAgent(db);

    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              thread_id: "thread-cached",
              title: "Cached",
              snippet: "cached",
              last_activity_at: "2026-02-16T12:01:00.000Z",
            },
          ],
          narrative: "Cached summary",
          actionItems: [],
        })
      )
      .mockResolvedValueOnce(new Response("upstream failure", { status: 500 }));

    await handleGetNarrative(db, fetcher, { nowMs: 1_000 });

    const failedBypassResponse = await handleGetNarrative(db, fetcher, {
      bypassCache: true,
      nowMs: 1_500,
    });
    expect(failedBypassResponse.status).toBe(502);

    const cachedResponse = await handleGetNarrative(db, fetcher, { nowMs: 2_000 });
    const cachedData = await cachedResponse.json();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cachedResponse.status).toBe(200);
    expect(cachedData.items[0]).toMatchObject({ threadId: "thread-cached" });
  });

  it("does not serve stale cache when expired entry refetch fails", async () => {
    await seedEmailAgent(db);

    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              thread_id: "thread-old",
              title: "Old",
              snippet: "old",
              last_activity_at: "2026-02-16T12:01:00.000Z",
            },
          ],
          narrative: "Summary old",
          actionItems: [],
        })
      )
      .mockResolvedValueOnce(new Response("upstream failure", { status: 500 }));

    await handleGetNarrative(db, fetcher, { nowMs: 1_000 });

    const response = await handleGetNarrative(db, fetcher, { nowMs: 61_000 });
    const data = await response.json();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(502);
    expect(data).toMatchObject({ error: "Unable to load email narrative" });
  });

  it("does not cache non-ok upstream responses", async () => {
    await seedEmailAgent(db);

    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("bad", { status: 500 }))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              thread_id: "thread-2",
              title: "Recovered",
              snippet: "ok",
              last_activity_at: "2026-02-16T12:02:00.000Z",
            },
          ],
          narrative: "Recovered summary",
          actionItems: ["Follow up"],
        })
      );

    const firstResponse = await handleGetNarrative(db, fetcher, { nowMs: 1_000 });
    const secondResponse = await handleGetNarrative(db, fetcher, { nowMs: 1_500 });
    const secondData = await secondResponse.json();

    expect(firstResponse.status).toBe(502);
    expect(secondResponse.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(secondData.items[0]).toMatchObject({ threadId: "thread-2" });
  });

  it("uses endpoint-aware cache keys", async () => {
    const dbOne = await createTestDb();
    const dbTwo = await createTestDb();

    await seedEmailAgent(dbOne, "http://email-agent-one.test/agent");
    await seedEmailAgent(dbTwo, "http://email-agent-two.test/agent");

    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              thread_id: "thread-one",
              title: "One",
              snippet: "one",
              last_activity_at: "2026-02-16T12:01:00.000Z",
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              thread_id: "thread-two",
              title: "Two",
              snippet: "two",
              last_activity_at: "2026-02-16T12:02:00.000Z",
            },
          ],
        })
      );

    const firstResponse = await handleGetNarrative(dbOne, fetcher, { nowMs: 1_000 });
    const secondResponse = await handleGetNarrative(dbTwo, fetcher, { nowMs: 1_500 });
    const firstData = await firstResponse.json();
    const secondData = await secondResponse.json();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenNthCalledWith(1, "http://email-agent-one.test/narrative", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, "http://email-agent-two.test/narrative", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    expect(firstData.items[0]).toMatchObject({ threadId: "thread-one" });
    expect(secondData.items[0]).toMatchObject({ threadId: "thread-two" });
  });

  it("treats only refresh=1 as cache bypass", () => {
    expect(shouldBypassNarrativeCache("1")).toBe(true);
    expect(shouldBypassNarrativeCache(null)).toBe(false);
    expect(shouldBypassNarrativeCache("0")).toBe(false);
    expect(shouldBypassNarrativeCache("true")).toBe(false);
    expect(shouldBypassNarrativeCache("")).toBe(false);
  });
});
