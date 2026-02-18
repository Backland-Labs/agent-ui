import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useNarrative } from "../useNarrative";
import type { LandingNarrativeItem, LandingNarrativeResponse } from "@/types";

function buildNarrativeItem(threadId: string): LandingNarrativeItem {
  return {
    threadId,
    agentName: "Email Agent",
    title: `Title for ${threadId}`,
    snippet: `Snippet for ${threadId}`,
    lastActivityAt: new Date().toISOString(),
    lastMessageRole: "assistant",
  };
}

function buildOkResponse(body: LandingNarrativeResponse): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function createDeferredResponse() {
  let resolvePromise: ((value: Response | PromiseLike<Response>) => void) | null = null;

  const promise = new Promise<Response>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: (response: Response) => {
      if (!resolvePromise) {
        throw new Error("Deferred response has no resolver");
      }

      resolvePromise(response);
    },
  };
}

describe("useNarrative", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads narrative on mount and sets success state", async () => {
    const payload: LandingNarrativeResponse = {
      items: [buildNarrativeItem("thread-1")],
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(buildOkResponse(payload));

    const { result } = renderHook(() => useNarrative());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/narrative",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(result.current.state).toBe("success");
    expect(result.current.narratives).toHaveLength(1);
    expect(result.current.error).toBeNull();
    expect(result.current.refreshError).toBeNull();
  });

  it("maps 404 response to source unavailable terminal error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("missing", { status: 404 }));

    const { result } = renderHook(() => useNarrative());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.state).toBe("terminal_error");
    expect(result.current.error).toBe("Email narrative source unavailable");
    expect(result.current.narratives).toEqual([]);
  });

  it("maps non-404 failures to generic terminal error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 500 }));

    const { result } = renderHook(() => useNarrative());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.state).toBe("terminal_error");
    expect(result.current.error).toBe("Unable to load email narrative");
  });

  it("keeps previous rows and sets refresh overlay error after refresh failure", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        buildOkResponse({
          items: [buildNarrativeItem("thread-1")],
        })
      )
      .mockResolvedValueOnce(new Response("bad", { status: 500 }));

    const { result } = renderHook(() => useNarrative());

    await waitFor(() => {
      expect(result.current.state).toBe("success");
    });

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false);
    });

    expect(result.current.state).toBe("success");
    expect(result.current.narratives.map((item) => item.threadId)).toEqual(["thread-1"]);
    expect(result.current.error).toBeNull();
    expect(result.current.refreshError).toBe("Unable to load email narrative");
  });

  it("transitions to terminal_error on 404 during refresh even with prior data", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        buildOkResponse({
          items: [buildNarrativeItem("thread-1")],
        })
      )
      .mockResolvedValueOnce(new Response("missing", { status: 404 }));

    const { result } = renderHook(() => useNarrative());

    await waitFor(() => {
      expect(result.current.state).toBe("success");
    });

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false);
    });

    expect(result.current.state).toBe("terminal_error");
    expect(result.current.narratives).toEqual([]);
    expect(result.current.error).toBe("Email narrative source unavailable");
    expect(result.current.refreshError).toBeNull();
  });

  it("keeps latest refresh result when earlier request resolves later", async () => {
    const requestA = createDeferredResponse();
    const requestB = createDeferredResponse();

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        buildOkResponse({
          items: [buildNarrativeItem("thread-initial")],
        })
      )
      .mockImplementationOnce(() => requestA.promise)
      .mockImplementationOnce(() => requestB.promise);

    const { result } = renderHook(() => useNarrative());

    await waitFor(() => {
      expect(result.current.state).toBe("success");
    });

    act(() => {
      result.current.refresh();
      result.current.refresh();
    });

    await act(async () => {
      requestB.resolve(
        buildOkResponse({
          items: [buildNarrativeItem("thread-b")],
        })
      );
      await Promise.resolve();
    });

    expect(result.current.narratives[0]?.threadId).toBe("thread-b");

    await act(async () => {
      requestA.resolve(
        buildOkResponse({
          items: [buildNarrativeItem("thread-a")],
        })
      );
      await Promise.resolve();
    });

    expect(result.current.narratives[0]?.threadId).toBe("thread-b");
    expect(result.current.refreshError).toBeNull();
  });

  it("aborts in-flight request on unmount", () => {
    const deferred = createDeferredResponse();
    let requestSignal: AbortSignal | undefined;

    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      requestSignal = (init as RequestInit | undefined)?.signal as AbortSignal | undefined;
      return deferred.promise;
    });

    const { unmount } = renderHook(() => useNarrative());

    expect(requestSignal).toBeDefined();
    expect(requestSignal?.aborted).toBe(false);

    unmount();

    expect(requestSignal?.aborted).toBe(true);
  });
});
