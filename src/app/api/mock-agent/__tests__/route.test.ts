import { describe, it, expect } from "vitest";
import { POST } from "../route";

interface SSEEvent {
  type: string;
  threadId?: string;
  runId?: string;
  messageId?: string;
  role?: string;
  delta?: string;
}

// Helper to read the full SSE body from a Response
async function readSSEBody(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

// Helper to parse individual SSE events from the body text
function parseSSEEvents(body: string): SSEEvent[] {
  return body
    .split("\n\n")
    .filter((chunk) => chunk.startsWith("data: "))
    .map((chunk) => JSON.parse(chunk.replace("data: ", "")));
}

// Helper to extract the full text content from SSE events
function extractTextContent(events: SSEEvent[]): string {
  return events
    .filter((e) => e.type === "TEXT_MESSAGE_CONTENT")
    .map((e) => e.delta)
    .join("");
}

// Helper to create a mock request
function createMockRequest(messages: { role: string; content: string }[]): Request {
  return new Request("http://localhost:3000/api/mock-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      threadId: "test-thread",
      runId: "test-run",
      messages,
    }),
  });
}

describe("POST /api/mock-agent", () => {
  it("returns a response with SSE headers", async () => {
    const req = createMockRequest([{ role: "user", content: "hello" }]);

    const response = await POST(req as Parameters<typeof POST>[0]);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("Connection")).toBe("keep-alive");
  });

  it("streams the correct sequence of AG-UI events", async () => {
    const req = createMockRequest([{ role: "user", content: "hello" }]);

    const response = await POST(req as Parameters<typeof POST>[0]);
    const body = await readSSEBody(response);
    const events = parseSSEEvents(body);

    // First event: RUN_STARTED
    expect(events[0]).toMatchObject({
      type: "RUN_STARTED",
      threadId: "test-thread",
      runId: "test-run",
    });

    // Second event: TEXT_MESSAGE_START
    expect(events[1]).toMatchObject({
      type: "TEXT_MESSAGE_START",
      role: "assistant",
    });
    expect(events[1]).toHaveProperty("messageId");

    // Middle events: TEXT_MESSAGE_CONTENT chunks
    const fullText = extractTextContent(events);
    expect(fullText).toContain("Hello");
    expect(fullText).toContain("mock AI assistant");

    // Second-to-last event: TEXT_MESSAGE_END
    const endEvent = events[events.length - 2];
    expect(endEvent).toMatchObject({ type: "TEXT_MESSAGE_END" });

    // Last event: RUN_FINISHED
    const finishEvent = events[events.length - 1];
    expect(finishEvent).toMatchObject({
      type: "RUN_FINISHED",
      threadId: "test-thread",
      runId: "test-run",
    });
  });

  it("generates correct mock response for help keyword", async () => {
    const req = createMockRequest([{ role: "user", content: "I need help" }]);

    const response = await POST(req as Parameters<typeof POST>[0]);
    const body = await readSSEBody(response);
    const events = parseSSEEvents(body);

    const fullText = extractTextContent(events);
    expect(fullText).toContain("here to help");
  });

  it("generates correct mock response for code keyword", async () => {
    const req = createMockRequest([{ role: "user", content: "tell me about code" }]);

    const response = await POST(req as Parameters<typeof POST>[0]);
    const body = await readSSEBody(response);
    const events = parseSSEEvents(body);

    const fullText = extractTextContent(events);
    expect(fullText).toContain("Next.js");
    expect(fullText).toContain("TypeScript");
  });

  it("generates fallback response for unknown input", async () => {
    const req = createMockRequest([{ role: "user", content: "random stuff xyz" }]);

    const response = await POST(req as Parameters<typeof POST>[0]);
    const body = await readSSEBody(response);
    const events = parseSSEEvents(body);

    const fullText = extractTextContent(events);
    expect(fullText).toContain("Thanks for your message");
    expect(fullText).toContain("random stuff xyz");
  });

  it("defaults to Hello when no user messages are provided", async () => {
    const req = createMockRequest([{ role: "assistant", content: "previous reply" }]);

    const response = await POST(req as Parameters<typeof POST>[0]);
    const body = await readSSEBody(response);
    const events = parseSSEEvents(body);

    const fullText = extractTextContent(events);
    expect(fullText).toContain("Hello");
    expect(fullText).toContain("mock AI assistant");
  });

  it("uses the last user message when multiple messages are provided", async () => {
    const req = createMockRequest([
      { role: "user", content: "first message" },
      { role: "assistant", content: "some reply" },
      { role: "user", content: "tell me about the weather" },
    ]);

    const response = await POST(req as Parameters<typeof POST>[0]);
    const body = await readSSEBody(response);
    const events = parseSSEEvents(body);

    const fullText = extractTextContent(events);
    expect(fullText).toContain("weather");
    expect(fullText).toContain("sunny day");
  });
});
