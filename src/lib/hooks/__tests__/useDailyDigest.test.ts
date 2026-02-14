import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useDailyDigest } from "../useDailyDigest";
import type { DailyDigest } from "@/types";

function createDigest(overrides: Partial<DailyDigest> = {}): DailyDigest {
  return {
    generatedAt: new Date().toISOString(),
    windowStart: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    windowEnd: new Date().toISOString(),
    metrics: [{ key: "new_threads", label: "New threads", value: 0 }],
    topItems: [],
    agentRollups: [],
    ...overrides,
  };
}

function mockFetchDigest(value: DailyDigest) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(value), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

describe("useDailyDigest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches digest on mount", async () => {
    const spy = mockFetchDigest(createDigest());

    const { result } = renderHook(() => useDailyDigest());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      "/api/digest",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(result.current.digest).toBeTruthy();
  });

  it("starts with loading true and resolves false", async () => {
    mockFetchDigest(createDigest());

    const { result } = renderHook(() => useDailyDigest());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("updates digest data from response", async () => {
    const payload = createDigest({
      metrics: [
        { key: "new_threads", label: "New threads", value: 2 },
        { key: "active_runs", label: "Active runs", value: 1 },
        { key: "agent_replies", label: "Agent replies", value: 3 },
      ],
      topItems: [
        {
          threadId: "thread-1",
          agentId: "agent-1",
          agentName: "Support",
          subject: "Thread alpha",
          snippet: "Draft complete",
          lastMessageRole: "assistant",
          lastActivityAt: new Date().toISOString(),
        },
      ],
    });

    mockFetchDigest(payload);

    const { result } = renderHook(() => useDailyDigest());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.digest?.metrics).toHaveLength(3);
    expect(result.current.digest?.topItems).toHaveLength(1);
    expect(result.current.digest?.topItems[0].subject).toBe("Thread alpha");
  });

  it("handles non-ok response with error state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 500 }));

    const { result } = renderHook(() => useDailyDigest());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.digest).toBeNull();
    expect(result.current.error).toBe("Unable to load daily digest");
  });

  it("handles fetch failure with error state", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useDailyDigest());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Unable to load daily digest");
  });

  it("refresh triggers additional fetch", async () => {
    const spy = mockFetchDigest(createDigest());

    const { result } = renderHook(() => useDailyDigest());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });
});
