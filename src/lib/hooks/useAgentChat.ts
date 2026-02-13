"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface UseAgentChatOptions {
  threadId: string;
  agentId: string;
}

interface UseAgentChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => void;
  stopGeneration: () => void;
}

export function useAgentChat({ threadId, agentId }: UseAgentChatOptions): UseAgentChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load messages from DB on mount
  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      try {
        const res = await fetch(`/api/threads/${threadId}/messages`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setMessages(
            data.map((m: { id: string; role: string; content: string }) => ({
              id: m.id,
              role: m.role as ChatMessage["role"],
              content: m.content,
            }))
          );
        }
      } catch {
        // Silently fail on initial load - thread may be new
      }
    }

    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  const sendMessage = useCallback(
    async (content: string) => {
      // Optimistically add user message
      const tempId = `temp-${Date.now()}`;
      const userMessage: ChatMessage = {
        id: tempId,
        role: "user",
        content,
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      // Prepare streaming assistant message
      const assistantTempId = `temp-assistant-${Date.now()}`;
      setMessages((prev) => [...prev, { id: assistantTempId, role: "assistant", content: "" }]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/gateway", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, agentId, message: content }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          throw new Error(errorData?.message || `Gateway error: ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let realUserMessageId: string | null = null;
        let realAssistantMessageId: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);

              switch (event.type) {
                case "USER_MESSAGE_CREATED":
                  // Server confirms user message persisted -- update temp ID
                  realUserMessageId = event.messageId;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === tempId ? { ...m, id: realUserMessageId! } : m))
                  );
                  break;

                case "TEXT_MESSAGE_START":
                  realAssistantMessageId = event.messageId;
                  break;

                case "TEXT_MESSAGE_CONTENT":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantTempId || m.id === realAssistantMessageId
                        ? { ...m, content: m.content + event.delta }
                        : m
                    )
                  );
                  break;

                case "TEXT_MESSAGE_END":
                  // Update the assistant message with its real ID
                  if (realAssistantMessageId) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantTempId ? { ...m, id: realAssistantMessageId! } : m
                      )
                    );
                  }
                  break;

                case "RUN_ERROR":
                  setError(event.message || "Agent error");
                  // Remove empty assistant message on error
                  setMessages((prev) =>
                    prev.filter((m) => m.id !== assistantTempId || m.content.length > 0)
                  );
                  break;
              }
            } catch {
              // Skip malformed events
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // User cancelled -- keep partial content
        } else {
          setError((err as Error).message);
          // Remove empty assistant message on error
          setMessages((prev) =>
            prev.filter((m) => m.id !== assistantTempId || m.content.length > 0)
          );
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [threadId, agentId]
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, isLoading, error, sendMessage, stopGeneration };
}
