"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DailyDigest } from "@/types";

interface UseDailyDigestReturn {
  digest: DailyDigest | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDailyDigest(): UseDailyDigestReturn {
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const fetchDigest = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setError(null);
      setLoading(true);
      const response = await fetch("/api/digest", { signal: controller.signal });

      if (!mountedRef.current || abortRef.current !== controller) return;

      if (!response.ok) {
        setDigest(null);
        setError("Unable to load daily digest");
        return;
      }

      const data = (await response.json()) as DailyDigest;
      if (!mountedRef.current || abortRef.current !== controller) return;

      setDigest(data);
      setError(null);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (!mountedRef.current) return;
      setDigest(null);
      setError("Unable to load daily digest");
    } finally {
      if (mountedRef.current && abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void fetchDigest();

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [fetchDigest]);

  const refresh = useCallback(() => {
    void fetchDigest();
  }, [fetchDigest]);

  return { digest, loading, error, refresh };
}
