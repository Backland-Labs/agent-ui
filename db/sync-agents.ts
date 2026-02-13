import { db } from "./client";
import { agents } from "./schema";
import { loadAgentsConfig } from "@/lib/agents";

export async function syncAgentsToDb() {
  const config = loadAgentsConfig();
  for (const agent of config) {
    await db
      .insert(agents)
      .values({
        id: agent.id,
        name: agent.name,
        endpoint_url: agent.endpoint_url,
        icon: agent.icon ?? null,
        description: agent.description ?? null,
      })
      .onConflictDoUpdate({
        target: agents.id,
        set: {
          name: agent.name,
          endpoint_url: agent.endpoint_url,
          icon: agent.icon ?? null,
          description: agent.description ?? null,
          updated_at: new Date(),
        },
      });
  }
}
