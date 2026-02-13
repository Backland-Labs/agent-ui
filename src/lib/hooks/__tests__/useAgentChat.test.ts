import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAgentChat } from "../useAgentChat";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a ReadableStream that emits SSE `data:` frames for each event object. */
function createSSEStream(
  events: Array<{ type: string; [key: string]: unknown }>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });
}

/** Build a ReadableStream that emits events with a per-chunk delay so the
 *  stream stays open long enough for stopGeneration / abort tests. */
function createSlowSSEStream(
  events: Array<{ type: string; [key: string]: unknown }>,
  delayMs: number
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (const event of events) {
        await new Promise((r) => setTimeout(r, delayMs));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });
}

/** Shortcut to build a full SSE Response for the gateway mock. */
function mockGatewayResponse(events: Array<{ type: string; [key: string]: unknown }>): Response {
  return new Response(createSSEStream(events), {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

/** Standard set of SSE events that represent a successful assistant reply. */
function standardAssistantEvents(text: string, messageId = "msg-1") {
  return [
    { type: "TEXT_MESSAGE_START", messageId, role: "assistant" },
    { type: "TEXT_MESSAGE_CONTENT", messageId, delta: text },
    { type: "TEXT_MESSAGE_END", messageId },
  ];
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("useAgentChat", () => {
  const threadId = "thread-1";
  const agentId = "agent-1";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. loads messages from API on mount -----------------------------------------------
  it("loads messages from API on mount", async () => {
    const apiMessages = [
      { id: "m1", role: "user", content: "hello" },
      { id: "m2", role: "assistant", content: "hi there" },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(apiMessages), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { result } = renderHook(() => useAgentChat({ threadId, agentId }));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(result.current.messages[0]).toEqual({
      id: "m1",
      role: "user",
      content: "hello",
    });
    expect(result.current.messages[1]).toEqual({
      id: "m2",
      role: "assistant",
      content: "hi there",
    });

    // The fetch should have been called with the correct URL
    expect(globalThis.fetch).toHaveBeenCalledWith(`/api/threads/${threadId}/messages`);
  });

  // 2. handles empty thread (no messages) ---------------------------------------------
  it("handles empty thread (no messages)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { result } = renderHook(() => useAgentChat({ threadId, agentId }));

    await waitFor(() => {
      // After loading completes, messages should be an empty array
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  // 3. sets isLoading while sending message -------------------------------------------
  it("sets isLoading while sending message", async () => {
    // Mock initial message load (empty)
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      // Mock gateway POST -- use a slow stream so isLoading stays true
      .mockResolvedValueOnce(
        new Response(createSlowSSEStream(standardAssistantEvents("reply"), 100), {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        })
      );

    const { result } = renderHook(() => useAgentChat({ threadId, agentId }));

    // Wait for mount fetch to finish
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    expect(result.current.isLoading).toBe(false);

    // Send a message -- do NOT await the act so we can inspect intermediate state
    act(() => {
      result.current.sendMessage("test");
    });

    // isLoading should be true while the stream is being read
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    // Eventually the stream finishes and isLoading goes back to false
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  // 4. adds user message optimistically ----------------------------------------------
  it("adds user message optimistically", async () => {
    // Mock initial load (empty)
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      // Mock gateway -- slow stream to keep the request open
      .mockResolvedValueOnce(
        new Response(createSlowSSEStream(standardAssistantEvents("ok"), 200), {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        })
      );

    const { result } = renderHook(() => useAgentChat({ threadId, agentId }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.sendMessage("optimistic hello");
    });

    // The user message should appear immediately (before the fetch completes)
    await waitFor(() => {
      const userMsg = result.current.messages.find(
        (m) => m.role === "user" && m.content === "optimistic hello"
      );
      expect(userMsg).toBeDefined();
    });

    // At this point the gateway fetch may still be in-flight, which is fine --
    // the point is the user message appeared before stream completion.
    // Wait for stream to complete to avoid dangling promises.
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  // 5. parses SSE stream and adds assistant message -----------------------------------
  it("parses SSE stream and adds assistant message", async () => {
    const sseEvents = [
      { type: "TEXT_MESSAGE_START", messageId: "asst-1", role: "assistant" },
      { type: "TEXT_MESSAGE_CONTENT", messageId: "asst-1", delta: "Hello " },
      { type: "TEXT_MESSAGE_CONTENT", messageId: "asst-1", delta: "world!" },
      { type: "TEXT_MESSAGE_END", messageId: "asst-1" },
    ];

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(mockGatewayResponse(sseEvents));

    const { result } = renderHook(() => useAgentChat({ threadId, agentId }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      result.current.sendMessage("hi");
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Find the assistant message and verify its content is the concatenated deltas
    const assistantMsg = result.current.messages.find((m) => m.role === "assistant");
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg!.content).toBe("Hello world!");

    // The assistant message ID should have been updated to the real one
    expect(assistantMsg!.id).toBe("asst-1");
  });

  // 6. handles network error gracefully -----------------------------------------------
  it("handles network error gracefully", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      // Gateway POST rejects (network error)
      .mockRejectedValueOnce(new Error("Network failure"));

    const { result } = renderHook(() => useAgentChat({ threadId, agentId }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      result.current.sendMessage("will fail");
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Network failure");
  });

  // 7. clears error on new message send -----------------------------------------------
  it("clears error on new message send", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      // First send -- fails
      .mockRejectedValueOnce(new Error("first failure"))
      // Second send -- succeeds
      .mockResolvedValueOnce(mockGatewayResponse(standardAssistantEvents("ok")));

    const { result } = renderHook(() => useAgentChat({ threadId, agentId }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    // First message triggers error
    await act(async () => {
      result.current.sendMessage("fail");
    });

    await waitFor(() => {
      expect(result.current.error).toBe("first failure");
    });

    // Second message should clear the error immediately
    await act(async () => {
      result.current.sendMessage("succeed");
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
  });

  // 8. stopGeneration aborts the fetch ------------------------------------------------
  it("stopGeneration aborts the fetch", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      // Gateway -- create a stream that will hang for a long time
      .mockImplementationOnce((_url, init) => {
        return new Promise<Response>((resolve, reject) => {
          const signal = (init as RequestInit | undefined)?.signal;
          // When the abort signal fires, reject so the hook's catch block runs
          if (signal) {
            signal.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }
          // Never resolve on its own -- we rely on abort
        });
      });

    const { result } = renderHook(() => useAgentChat({ threadId, agentId }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    // Start sending
    act(() => {
      result.current.sendMessage("hello");
    });

    // isLoading should become true
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    // Now abort
    act(() => {
      result.current.stopGeneration();
    });

    // isLoading should become false (abort handled gracefully)
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // AbortError should NOT set the error state (the hook silences it)
    expect(result.current.error).toBeNull();
  });
});
