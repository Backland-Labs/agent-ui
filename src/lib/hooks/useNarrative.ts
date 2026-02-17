"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  LandingNarrativeItem,
  LandingNarrativeResponse,
  LandingNarrativeState,
} from "@/types";

interface UseNarrativeReturn {
  narratives: LandingNarrativeItem[];
  state: LandingNarrativeState;
  loading: boolean;
  error: string | null;
  refreshError: string | null;
  isRefreshing: boolean;
  refresh: () => void;
}

const GENERIC_ERROR_MESSAGE = "Unable to load email narrative";
const SOURCE_UNAVAILABLE_ERROR_MESSAGE = "Email narrative source unavailable";

function getErrorMessage(status: number): string {
  if (status === 404) {
    return SOURCE_UNAVAILABLE_ERROR_MESSAGE;
  }

  return GENERIC_ERROR_MESSAGE;
}

function hasStableState(state: LandingNarrativeState): boolean {
  return state === "success" || state === "empty";
}

function toNarrativeState(items: LandingNarrativeItem[]): LandingNarrativeState {
  return items.length > 0 ? "success" : "empty";
}

export function useNarrative(): UseNarrativeReturn {
  const [narratives, setNarratives] = useState<LandingNarrativeItem[]>([]);
  const [state, setState] = useState<LandingNarrativeState>("initial_loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const stateRef = useRef<LandingNarrativeState>("initial_loading");

  const setNarrativeState = useCallback((nextState: LandingNarrativeState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const fetchNarrative = useCallback(
    async (mode: "initial" | "refresh") => {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const isRefreshRequest = mode === "refresh" && hasStableState(stateRef.current);

      if (isRefreshRequest) {
        setIsRefreshing(true);
        setRefreshError(null);
      } else {
        setNarrativeState("initial_loading");
        setError(null);
        setRefreshError(null);
        setIsRefreshing(false);
      }

      try {
        const response = await fetch("/api/narrative", { signal: controller.signal });

        if (!mountedRef.current || requestIdRef.current !== requestId) {
          return;
        }

        if (!response.ok) {
          const mappedError = getErrorMessage(response.status);

          if (isRefreshRequest) {
            setRefreshError(mappedError);
          } else {
            setNarratives([]);
            setNarrativeState("terminal_error");
            setError(mappedError);
          }

          return;
        }

        const data = (await response.json()) as LandingNarrativeResponse;

        if (!mountedRef.current || requestIdRef.current !== requestId) {
          return;
        }

        const items = Array.isArray(data.items) ? data.items : [];

        setNarratives(items);
        setNarrativeState(toNarrativeState(items));
        setError(null);
        setRefreshError(null);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return;
        }

        if (!mountedRef.current || requestIdRef.current !== requestId) {
          return;
        }

        if (isRefreshRequest) {
          setRefreshError(GENERIC_ERROR_MESSAGE);
          return;
        }

        setNarratives([]);
        setNarrativeState("terminal_error");
        setError(GENERIC_ERROR_MESSAGE);
      } finally {
        if (mountedRef.current && requestIdRef.current === requestId) {
          setIsRefreshing(false);
        }
      }
    },
    [setNarrativeState]
  );

  useEffect(() => {
    mountedRef.current = true;
    void fetchNarrative("initial");

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [fetchNarrative]);

  const refresh = useCallback(() => {
    void fetchNarrative("refresh");
  }, [fetchNarrative]);

  return {
    narratives,
    state,
    loading: state === "initial_loading",
    error,
    refreshError,
    isRefreshing,
    refresh,
  };
}
