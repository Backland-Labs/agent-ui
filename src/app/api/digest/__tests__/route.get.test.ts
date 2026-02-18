import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type MockQueryResult = Array<Record<string, unknown>>;

function createMockQuery(result: MockQueryResult) {
  type MockQuery = {
    from: () => MockQuery;
    innerJoin: () => MockQuery;
    where: () => MockQuery;
    orderBy: () => MockQuery;
    groupBy: () => MockQuery;
    limit: () => Promise<MockQueryResult>;
    then: (
      resolve: (value: MockQueryResult) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise<unknown>;
  };

  const chain: MockQuery = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    groupBy: () => chain,
    limit: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };

  return chain;
}

const mockDb = {
  select: vi.fn(() => createMockQuery([])),
  get selectCallCount() {
    return this.select.mock.calls.length;
  },
};

function setMockDb(queryResults: MockQueryResult[]) {
  let cursor = 0;

  mockDb.select = vi.fn(() => {
    const queryResult = queryResults[cursor] ?? [];
    cursor += 1;
    return createMockQuery(queryResult);
  }) as typeof mockDb.select;
}

vi.mock("../../../../../db/client", () => ({
  db: mockDb,
}));

async function importRoute() {
  vi.resetModules();
  const route = await import("../route");
  return route as typeof import("../route");
}

describe("GET /api/digest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    setMockDb([]);
  });

  it("uses valid now param for window boundaries", async () => {
    setMockDb([
      [
        {
          id: "thread-1",
          agent_id: "agent-1",
          title: "Morning",
          last_activity_at: new Date("2026-02-14T11:00:00.000Z"),
          agent_name: "Agent One",
        },
      ],
      [],
      [{ value: 1 }],
      [{ value: 0 }],
      [{ value: 1 }],
      [{ agent_id: "agent-1", agent_name: "Agent One", count: 1 }],
      [{ agent_id: "agent-1", agent_name: "Agent One", count: 1 }],
    ]);

    const { GET } = await importRoute();
    const request = new NextRequest("http://localhost/api/digest?now=2026-02-14T12:00:00.000Z");

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockDb.selectCallCount).toBe(7);
    expect(body.generatedAt).toContain("2026-02-14T12:00:00");
  });

  it("falls back to current time for invalid now param", async () => {
    const now = Date.now();

    setMockDb([
      [
        {
          id: "thread-1",
          agent_id: "agent-1",
          title: "Fallback",
          last_activity_at: new Date("2026-02-14T11:00:00.000Z"),
          agent_name: "Agent One",
        },
      ],
      [],
      [{ value: 1 }],
      [{ value: 0 }],
      [{ value: 1 }],
      [{ agent_id: "agent-1", agent_name: "Agent One", count: 1 }],
      [{ agent_id: "agent-1", agent_name: "Agent One", count: 1 }],
    ]);

    const { GET } = await importRoute();
    const request = new NextRequest("http://localhost/api/digest?now=not-a-date");

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockDb.selectCallCount).toBe(7);
    expect(typeof body.generatedAt).toBe("string");
    expect(new Date(body.generatedAt).getTime()).toBeGreaterThanOrEqual(now - 5_000);
  });
});
