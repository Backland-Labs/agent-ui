import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { HttpAgent, AbstractAgent } from "@ag-ui/client";
import { NextRequest } from "next/server";
import { loadAgentsConfig } from "@/lib/agents";

const serviceAdapter = new ExperimentalEmptyAdapter();

// Load agents from config and create HttpAgent instances
function buildAgents(): Record<string, AbstractAgent> {
  const agentsConfig = loadAgentsConfig();
  const agents: Record<string, AbstractAgent> = {};
  for (const agent of agentsConfig) {
    agents[agent.id] = new HttpAgent({ url: agent.endpoint_url });
  }
  return agents;
}

const runtime = new CopilotRuntime({
  // @ts-expect-error - CopilotKit TypeScript types have issues with agents property
  agents: buildAgents(),
});

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
