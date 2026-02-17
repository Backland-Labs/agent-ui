export interface AgentConfig {
  id: string;
  name: string;
  endpoint_url: string;
  api_docs?: string;
  icon?: string;
  description?: string;
}

export interface AgentsConfigFile {
  agents: AgentConfig[];
}

export type AgentStatus = "online" | "offline" | "unknown";

export interface AgentWithStatus extends AgentConfig {
  status: AgentStatus;
  lastSeenAt?: Date;
}
