import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, within } from "@testing-library/react";
import { AgentInboxPreview } from "../AgentInboxPreview";
import { DailyDigestCard } from "../DailyDigestCard";
import { LandingCalendarCard } from "../LandingCalendarCard";
import type { DailyDigest } from "@/types";
import type { CalendarEvent, AccountError } from "@/types/calendar.types";

const narrativeText = "48h inbox summary with high-signal updates";
const narrativeActionItems = ["Reply to sponsor request"];

describe("AgentInboxPreview", () => {
  it("shows loading state", () => {
    const { container } = render(
      <AgentInboxPreview
        narrative=""
        actionItems={[]}
        state="initial_loading"
        terminalError={null}
        refreshError={null}
        isRefreshing={false}
        refresh={() => undefined}
      />
    );
    const getByText = within(container).getByText;

    expect(getByText("Loading email narrative...")).toBeTruthy();
  });

  it("shows empty state when no threads", () => {
    const { container } = render(
      <AgentInboxPreview
        narrative=""
        actionItems={[]}
        state="empty"
        terminalError={null}
        refreshError={null}
        isRefreshing={false}
        refresh={() => undefined}
      />
    );
    const getByText = within(container).getByText;

    expect(getByText("All caught up.")).toBeTruthy();
    expect(getByText("No recent items to triage from the email agent.")).toBeTruthy();
  });

  it("shows an error state", () => {
    const { container } = render(
      <AgentInboxPreview
        narrative=""
        actionItems={[]}
        state="terminal_error"
        terminalError="Unable to load email narrative"
        refreshError={null}
        isRefreshing={false}
        refresh={() => undefined}
      />
    );
    const getByText = within(container).getByText;

    expect(getByText("Unable to load email narrative")).toBeTruthy();
  });

  it("shows source unavailable copy when provided by hook", () => {
    const { container } = render(
      <AgentInboxPreview
        narrative=""
        actionItems={[]}
        state="terminal_error"
        terminalError="Email narrative source unavailable"
        refreshError={null}
        isRefreshing={false}
        refresh={() => undefined}
      />
    );
    const getByText = within(container).getByText;

    expect(getByText("Email narrative source unavailable")).toBeTruthy();
  });

  it("renders narrative and action items", () => {
    const { container } = render(
      <AgentInboxPreview
        narrative={narrativeText}
        actionItems={narrativeActionItems}
        state="success"
        terminalError={null}
        refreshError={null}
        isRefreshing={false}
        refresh={() => undefined}
      />
    );
    const getByText = within(container).getByText;

    expect(getByText("Narrative")).toBeTruthy();
    expect(getByText(narrativeText)).toBeTruthy();
    expect(getByText("Action Items")).toBeTruthy();
    expect(getByText("Reply to sponsor request")).toBeTruthy();
  });

  it("keeps summary visible and offers retry when refresh error overlays success", () => {
    const onRefresh = () => undefined;

    const { container } = render(
      <AgentInboxPreview
        narrative={narrativeText}
        actionItems={[]}
        state="success"
        terminalError={null}
        refreshError="Unable to load email narrative"
        isRefreshing={false}
        refresh={onRefresh}
      />
    );
    const getByText = within(container).getByText;

    expect(getByText("Unable to load email narrative")).toBeTruthy();
    expect(getByText("Retry")).toBeTruthy();
    expect(getByText(narrativeText)).toBeTruthy();
    expect(getByText("No immediate action items.")).toBeTruthy();
  });

  it("calls refresh when the refresh button is clicked", () => {
    const onRefresh = vi.fn();

    const { container } = render(
      <AgentInboxPreview
        narrative={narrativeText}
        actionItems={narrativeActionItems}
        state="success"
        terminalError={null}
        refreshError={null}
        isRefreshing={false}
        refresh={onRefresh}
      />
    );

    const refreshButton = within(container).getByRole("button", { name: "Refresh" });
    fireEvent.click(refreshButton);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

describe("DailyDigestCard", () => {
  const digest: DailyDigest = {
    generatedAt: new Date().toISOString(),
    windowStart: new Date().toISOString(),
    windowEnd: new Date().toISOString(),
    metrics: [
      { key: "new_threads", label: "New threads", value: 2 },
      { key: "active_runs", label: "Active runs", value: 1 },
      { key: "agent_replies", label: "Agent replies", value: 4 },
    ],
    topItems: [
      {
        threadId: "thread-1",
        agentId: "agent-1",
        agentName: "Support",
        subject: "Morning queue",
        snippet: "Reply prepared",
        lastMessageRole: "assistant",
        lastActivityAt: new Date().toISOString(),
      },
    ],
    agentRollups: [],
  };

  it("shows loading state", () => {
    const { container } = render(
      <DailyDigestCard digest={null} loading={true} error={null} onRefresh={() => undefined} />
    );
    const getByText = within(container).getByText;

    expect(getByText("Loading digest...")).toBeTruthy();
  });

  it("shows empty-state text when no metrics", () => {
    const { container } = render(
      <DailyDigestCard
        digest={{
          ...digest,
          metrics: [],
          topItems: [],
        }}
        loading={false}
        error={null}
        onRefresh={() => undefined}
      />
    );
    const getByText = within(container).getByText;

    expect(getByText("No activity tracked in the last 24h.")).toBeTruthy();
    expect(getByText("All caught up.")).toBeTruthy();
  });

  it("renders metrics and items", () => {
    const { container } = render(
      <DailyDigestCard digest={digest} loading={false} error={null} onRefresh={() => undefined} />
    );
    const getByText = within(container).getByText;

    expect(getByText("New threads")).toBeTruthy();
    expect(getByText("2")).toBeTruthy();
    expect(getByText("Morning queue")).toBeTruthy();
  });
});

describe("LandingCalendarCard", () => {
  const events: CalendarEvent[] = [
    {
      id: "event-1",
      title: "Standup",
      isAllDay: false,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 1800000).toISOString(),
      account: "Work",
      htmlLink: "https://calendar.local/event",
      meetLink: null,
    },
  ];

  it("shows loading state", () => {
    const { container } = render(
      <LandingCalendarCard
        events={[]}
        errors={[]}
        loading={true}
        isConfigured={true}
        refresh={() => undefined}
      />
    );
    const getByText = within(container).getByText;

    expect(getByText("Loading calendar...")).toBeTruthy();
  });

  it("shows no-events message", () => {
    const { container } = render(
      <LandingCalendarCard
        events={[]}
        errors={[]}
        loading={false}
        isConfigured={true}
        refresh={() => undefined}
      />
    );
    const getByText = within(container).getByText;

    expect(getByText("No calendar items for today.")).toBeTruthy();
  });

  it("shows error state and retry action", () => {
    const errors: AccountError[] = [{ account: "work", message: "network" }];

    const { container } = render(
      <LandingCalendarCard
        events={[]}
        errors={errors}
        loading={false}
        isConfigured={true}
        refresh={() => undefined}
      />
    );
    const getByText = within(container).getByText;

    expect(getByText("Couldn't load calendar events.")).toBeTruthy();
    expect(getByText("Retry")).toBeTruthy();
  });

  it("renders event rows", () => {
    const { container } = render(
      <LandingCalendarCard
        events={events}
        errors={[]}
        loading={false}
        isConfigured={true}
        refresh={() => undefined}
      />
    );
    const getByText = within(container).getByText;

    expect(getByText("Standup")).toBeTruthy();
  });
});
