export interface DailyDigestMetric {
  key: "new_threads" | "active_runs" | "agent_replies";
  label: string;
  value: number;
}

export interface DigestItem {
  threadId: string;
  agentId: string;
  agentName: string;
  subject: string;
  snippet: string;
  lastMessageRole: "user" | "assistant" | "system" | null;
  lastActivityAt: string;
}

export interface DigestAgentRollup {
  agentId: string;
  agentName: string;
  newThreads: number;
  agentReplies: number;
}

export interface DailyDigest {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  metrics: DailyDigestMetric[];
  topItems: DigestItem[];
  agentRollups: DigestAgentRollup[];
}

export interface LandingInboxThreadPreview {
  threadId: string;
  agentName: string;
  title: string;
  snippet: string;
  lastActivityAt: string;
  lastMessageRole: "user" | "assistant" | "system" | null;
}
