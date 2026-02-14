import type { AgentConfig, AgentsConfigFile } from "./types";
import agentsConfigJson from "../../../agents.config.json";

// Load agents from the config file
export function loadAgentsConfig(): AgentConfig[] {
  const config = agentsConfigJson as AgentsConfigFile;
  return config.agents;
}

// Get a specific agent by ID
export function getAgentById(id: string): AgentConfig | undefined {
  const agents = loadAgentsConfig();
  return agents.find((agent) => agent.id === id);
}

// Get all agent IDs
export function getAgentIds(): string[] {
  return loadAgentsConfig().map((agent) => agent.id);
}
