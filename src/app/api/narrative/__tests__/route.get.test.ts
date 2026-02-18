import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type AgentRow = { endpoint_url: string; name?: string };

type MockDb = {
  select: ReturnType<typeof vi.fn>;
};

const mockDb: MockDb = {
  select: vi.fn(),
};
const syncAgentsToDb = vi.fn();

function createMockDb(agents: AgentRow[]): MockDb {
  return {
    select: vi.fn(() => ({
      from: () => ({
        where: () =>
          Promise.resolve(
            agents.map((agent) => ({
              endpointUrl: agent.endpoint_url,
              name: agent.name ?? "Email Agent",
            }))
          ),
      }),
    })),
  };
}

function setMockDb(agents: AgentRow[]) {
  mockDb.select = createMockDb(agents).select;
}

vi.mock("../../../../../db/client", () => ({
  db: mockDb,
}));

vi.mock("../../../../../db/sync-agents", () => ({
  syncAgentsToDb,
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function importRoute() {
  syncAgentsToDb.mockReset().mockResolvedValue(undefined);
  vi.resetModules();
  return import("../route");
}

describe("GET /api/narrative", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    syncAgentsToDb.mockReset().mockResolvedValue(undefined);
    setMockDb([]);
  });

  it("normalizes endpoint and refreshes cache on refresh=1", async () => {
    setMockDb([{ endpoint_url: "https://agent.example/agent", name: "Email Agent" }]);

    const route = await importRoute();
    await route.resetNarrativeCacheForTests();

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              thread_id: "first",
              title: "First",
              snippet: "first",
              timestamp: 1_700_000_000_000,
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              thread_id: "second",
              title: "Second",
              snippet: "second",
              timestamp: 1_700_000_100_000,
            },
          ],
        })
      );

    const firstResponse = await route.GET(new NextRequest("http://localhost/api/narrative"));
    const firstData = await firstResponse.json();
    const secondResponse = await route.GET(
      new NextRequest("http://localhost/api/narrative?refresh=1")
    );
    const secondData = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(syncAgentsToDb).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(1, "https://agent.example/narrative", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    expect(firstData.items[0]).toMatchObject({ threadId: "first" });
    expect(secondData.items[0]).toMatchObject({ threadId: "second" });
  });

  it("serves cached data when refresh flag is not set", async () => {
    setMockDb([{ endpoint_url: "https://agent.example/agent" }]);
    const route = await importRoute();

    await route.resetNarrativeCacheForTests();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            thread_id: "cached",
            title: "Cached",
            snippet: "cached",
            timestamp: 1_700_000_000_000,
          },
        ],
      })
    );

    const firstResponse = await route.GET(new NextRequest("http://localhost/api/narrative"));
    const firstData = await firstResponse.json();
    const secondResponse = await route.GET(new NextRequest("http://localhost/api/narrative"));
    const secondData = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(syncAgentsToDb).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(firstData).toMatchObject(secondData);
  });
});
