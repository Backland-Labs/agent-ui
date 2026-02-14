import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("@/lib/hooks", () => ({
  useDailyDigest: vi.fn(),
}));

vi.mock("@/lib/hooks/useCalendarEvents", () => ({
  useCalendarEvents: vi.fn(),
}));

import { useDailyDigest } from "@/lib/hooks";
import { useCalendarEvents } from "@/lib/hooks/useCalendarEvents";
import { LandingContent } from "../LandingContent";

describe("LandingContent", () => {
  beforeEach(() => {
    vi.mocked(useDailyDigest).mockReturnValue({
      digest: null,
      loading: false,
      error: null,
      refresh: () => undefined,
    });

    vi.mocked(useCalendarEvents).mockReturnValue({
      events: [],
      errors: [],
      loading: false,
      isConfigured: true,
      refresh: () => undefined,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears thread error immediately while a refresh is in progress", async () => {
    let resolveRetry: ((response: Response) => void) | null = null;

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("bad", { status: 500 }))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveRetry = resolve;
          })
      );

    render(<LandingContent />);

    await waitFor(() => {
      expect(screen.getByText("Unable to load inbox preview")).toBeTruthy();
    });

    const inboxHeading = screen.getByRole("heading", { name: "Inbox Preview" });
    const inboxSection = inboxHeading.closest("section");

    if (!inboxSection) {
      throw new Error("Inbox section was not rendered");
    }

    fireEvent.click(within(inboxSection).getByRole("button", { name: "Refresh" }));

    expect(within(inboxSection).queryByText("Unable to load inbox preview")).toBeNull();
    expect(within(inboxSection).getByText("Loading inbox preview...")).toBeTruthy();

    if (!resolveRetry) {
      throw new Error("Retry request was not started");
    }

    const resolveRetryRequest = resolveRetry as (response: Response) => void;

    resolveRetryRequest(
      new Response(
        JSON.stringify([
          {
            id: "thread-1",
            agent_name: "Support",
            title: "Morning queue",
            last_message: "Draft complete",
            last_message_role: "assistant",
            last_message_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        ]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    await waitFor(() => {
      expect(within(inboxSection).getByText("Morning queue")).toBeTruthy();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
