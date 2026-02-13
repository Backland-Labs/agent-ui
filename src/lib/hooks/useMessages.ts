"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/types/database.types";

export function useMessages(threadId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;
      setMessages((data as Message[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch messages"));
    } finally {
      setLoading(false);
    }
  }, [supabase, threadId]);

  const addMessage = useCallback(
    async (role: string, content: string, metadata: object = {}) => {
      const { data, error: insertError } = await supabase
        .from("messages")
        .insert({
          thread_id: threadId,
          role,
          content,
          metadata,
        } as never)
        .select()
        .single();

      if (insertError) throw insertError;

      // Update thread's last_activity_at
      await supabase
        .from("threads")
        .update({ last_activity_at: new Date().toISOString() } as never)
        .eq("id", threadId);

      const newMessage = data as Message;
      setMessages((prev) => [...prev, newMessage]);
      return newMessage;
    },
    [supabase, threadId]
  );

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  return {
    messages,
    loading,
    error,
    refresh: fetchMessages,
    addMessage,
  };
}
