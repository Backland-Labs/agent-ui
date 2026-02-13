import { describe, it, expect } from "vitest";
import { loadAgentsConfig, getAgentById, getAgentIds } from "../config";

describe("loadAgentsConfig", () => {
  it("returns an array of agents", () => {
    const agents = loadAgentsConfig();
    expect(Array.isArray(agents)).toBe(true);
    expect(agents.length).toBeGreaterThan(0);
  });

  it("each agent has required fields", () => {
    const agents = loadAgentsConfig();
    for (const agent of agents) {
      expect(agent).toHaveProperty("id");
      expect(agent).toHaveProperty("name");
      expect(agent).toHaveProperty("endpoint_url");
      expect(typeof agent.id).toBe("string");
      expect(typeof agent.name).toBe("string");
      expect(typeof agent.endpoint_url).toBe("string");
    }
  });
});

describe("getAgentById", () => {
  it("returns the matching agent when given a valid id", () => {
    const agents = loadAgentsConfig();
    const firstAgent = agents[0];
    const result = getAgentById(firstAgent.id);
    expect(result).toBeDefined();
    expect(result!.id).toBe(firstAgent.id);
    expect(result!.name).toBe(firstAgent.name);
  });

  it("returns undefined for a nonexistent agent", () => {
    const agent = getAgentById("nonexistent-agent-id");
    expect(agent).toBeUndefined();
  });
});

describe("getAgentIds", () => {
  it("returns an id for every configured agent", () => {
    const ids = getAgentIds();
    const agents = loadAgentsConfig();
    expect(ids).toHaveLength(agents.length);
    for (const agent of agents) {
      expect(ids).toContain(agent.id);
    }
  });
});
