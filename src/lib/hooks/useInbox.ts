"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { InboxItem } from "@/types/database.types";

export function useInbox(agentFilter?: string) {
  const [threads, setThreads] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  const fetchThreads = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase.from("inbox_view").select("*");

      if (agentFilter) {
        query = query.eq("agent_id", agentFilter);
      }

      const { data, error: fetchError } = await query.order("last_activity_at", {
        ascending: false,
      });

      if (fetchError) throw fetchError;
      setThreads((data as InboxItem[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch threads"));
    } finally {
      setLoading(false);
    }
  }, [supabase, agentFilter]);

  const createThread = useCallback(
    async (agentId: string, title?: string) => {
      const { data, error: createError } = await supabase
        .from("threads")
        .insert({
          agent_id: agentId,
          title: title || "New conversation",
          status: "active",
        } as never)
        .select()
        .single();

      if (createError) throw createError;
      await fetchThreads();
      return data as { id: string };
    },
    [supabase, fetchThreads]
  );

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  return {
    threads,
    loading,
    error,
    refresh: fetchThreads,
    createThread,
  };
}
