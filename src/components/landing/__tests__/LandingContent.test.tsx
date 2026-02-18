import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useDailyDigest } from "@/lib/hooks";
import { useCalendarEvents } from "@/lib/hooks/useCalendarEvents";
import { useNarrative } from "@/lib/hooks";
import { LandingContent } from "../LandingContent";

vi.mock("@/lib/hooks", () => ({
  useDailyDigest: vi.fn(),
  useNarrative: vi.fn(),
}));

vi.mock("@/lib/hooks/useCalendarEvents", () => ({
  useCalendarEvents: vi.fn(),
}));

const mockUseNarrative = vi.mocked(useNarrative);
type UseNarrativeReturn = ReturnType<typeof useNarrative>;

const sampleNarrativeText = "48h inbox summary with five unread emails reviewed";
const sampleActionItem = "Reply to sponsor request";

function buildNarrativeHookReturn(overrides: Partial<UseNarrativeReturn> = {}): UseNarrativeReturn {
  return {
    narrative: "",
    actionItems: [],
    narratives: [],
    state: "empty",
    loading: false,
    error: null,
    refreshError: null,
    isRefreshing: false,
    refresh: () => undefined,
    ...overrides,
  };
}

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

  it("renders narrative summary from the hook", () => {
    const refreshNarrative = vi.fn();

    mockUseNarrative.mockReturnValue(
      buildNarrativeHookReturn({
        narrative: sampleNarrativeText,
        actionItems: [sampleActionItem],
        state: "success",
        refresh: refreshNarrative,
      })
    );

    render(<LandingContent />);

    expect(screen.getByText(sampleNarrativeText)).toBeTruthy();
    expect(screen.getByText(sampleActionItem)).toBeTruthy();

    const narrativeSection = screen.getByText("Email Narrative").closest("section");
    if (!narrativeSection) {
      throw new Error("Narrative section should render");
    }
    const refreshButton = within(narrativeSection).getByRole("button", { name: "Refresh" });
    fireEvent.click(refreshButton);

    expect(refreshNarrative).toHaveBeenCalledTimes(1);
  });

  it("shows narrative error state", () => {
    mockUseNarrative.mockReturnValue(
      buildNarrativeHookReturn({
        state: "terminal_error",
        error: "Unable to load email narrative",
      })
    );

    render(<LandingContent />);

    expect(screen.getByText("Unable to load email narrative")).toBeTruthy();
  });

  it("keeps narrative, digest, and calendar heading order with digest/calendar grouped", () => {
    mockUseNarrative.mockReturnValue(buildNarrativeHookReturn());

    const { container } = render(<LandingContent />);

    const headingTexts = Array.from(container.querySelectorAll("h2")).map(
      (node) => node.textContent
    );
    const narrativeIndex = headingTexts.indexOf("Email Narrative");
    const digestIndex = headingTexts.indexOf("Daily Digest");
    const calendarIndex = headingTexts.indexOf("Today's Calendar");

    expect(narrativeIndex).toBeGreaterThan(-1);
    expect(digestIndex).toBeGreaterThan(-1);
    expect(calendarIndex).toBeGreaterThan(-1);
    expect(narrativeIndex).toBeLessThan(digestIndex);
    expect(digestIndex).toBeLessThan(calendarIndex);

    const scoped = within(container);
    const digestSection = scoped.getAllByText("Daily Digest")[0]?.closest("section");
    const calendarSection = scoped.getAllByText("Today's Calendar")[0]?.closest("section");

    if (!digestSection || !calendarSection) {
      throw new Error("Digest and calendar sections should render");
    }

    expect(digestSection.parentElement).toBe(calendarSection.parentElement);
    expect(digestSection.parentElement?.className).toContain("space-y-4");
  });
});
