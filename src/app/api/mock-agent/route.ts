import { NextRequest } from "next/server";

// AG-UI Event Types
interface RunAgentInput {
  threadId: string;
  runId: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
}

// Helper to create SSE formatted event
function sseEvent(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// Helper to delay for simulating typing
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Generate a mock response based on user input
function getMockResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase();

  if (lowerMessage.includes("hello") || lowerMessage.includes("hi")) {
    return "Hello! I'm a mock AI assistant for testing the Agent UI. How can I help you today?";
  }

  if (lowerMessage.includes("help")) {
    return "I'm here to help! This is a mock agent that simulates the AG-UI protocol. You can send me messages and I'll respond with pre-defined answers. Try asking me about the weather, or just say hello!";
  }

  if (lowerMessage.includes("weather")) {
    return "I'm a mock agent, so I can't actually check the weather. But let's pretend it's a beautiful sunny day with a comfortable 72°F (22°C). Perfect weather for testing AI interfaces!";
  }

  if (lowerMessage.includes("code") || lowerMessage.includes("programming")) {
    return "While I'm just a mock agent, I can tell you that the Agent UI is built with:\n\n- **Next.js 16** with App Router\n- **TypeScript** for type safety\n- **Tailwind CSS** for styling\n- **shadcn/ui** for components\n- **AG-UI protocol** for agent communication\n- **Turso + Drizzle** for persistence\n\nPretty neat stack!";
  }

  return `Thanks for your message! You said: "${userMessage}"\n\nI'm a mock agent for testing purposes. I can respond to greetings, help requests, questions about the weather, or programming topics. What would you like to talk about?`;
}

export async function POST(req: NextRequest) {
  const input: RunAgentInput = await req.json();
  const { threadId, runId, messages } = input;

  // Get the last user message
  const lastUserMessage = messages.filter((m) => m.role === "user").pop()?.content || "Hello";

  // Generate mock response
  const responseText = getMockResponse(lastUserMessage);
  const messageId = `msg_${Date.now()}`;

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // RUN_STARTED event
      controller.enqueue(
        encoder.encode(
          sseEvent({
            type: "RUN_STARTED",
            threadId,
            runId,
          })
        )
      );

      await delay(100);

      // TEXT_MESSAGE_START event
      controller.enqueue(
        encoder.encode(
          sseEvent({
            type: "TEXT_MESSAGE_START",
            messageId,
            role: "assistant",
          })
        )
      );

      await delay(50);

      // Stream the response word by word to simulate typing
      const words = responseText.split(" ");
      for (let i = 0; i < words.length; i++) {
        const delta = i === 0 ? words[i] : " " + words[i];
        controller.enqueue(
          encoder.encode(
            sseEvent({
              type: "TEXT_MESSAGE_CONTENT",
              messageId,
              delta,
            })
          )
        );
        // Random delay between 20-80ms to simulate typing
        await delay(Math.random() * 60 + 20);
      }

      // TEXT_MESSAGE_END event
      controller.enqueue(
        encoder.encode(
          sseEvent({
            type: "TEXT_MESSAGE_END",
            messageId,
          })
        )
      );

      await delay(50);

      // RUN_FINISHED event
      controller.enqueue(
        encoder.encode(
          sseEvent({
            type: "RUN_FINISHED",
            threadId,
            runId,
          })
        )
      );

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
