import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db as defaultDb } from "../../../../../../db/client";
import { agents } from "../../../../../../db/schema";
import { logger } from "@/lib/server/logger";

type Db = typeof defaultDb;

interface HealthCheckOptions {
  timeoutMs?: number;
}

export async function handleHealthCheck(
  agentId: string,
  db: Db,
  options: HealthCheckOptions = {}
): Promise<NextResponse> {
  const { timeoutMs = 5000 } = options;

  const agent = await db.select().from(agents).where(eq(agents.id, agentId)).get();

  if (!agent) {
    return NextResponse.json({ error: `Agent '${agentId}' not found` }, { status: 404 });
  }

  let isOnline = false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(agent.endpoint_url, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    isOnline = response.ok;
  } catch (error) {
    logger.debug({ event: "health.check_failed", agentId, err: error }, "health check failed");
    isOnline = false;
  }

  const now = Date.now();
  const newStatus = isOnline ? "online" : "offline";

  await db
    .update(agents)
    .set({
      status: newStatus,
      ...(isOnline ? { last_seen_at: now } : {}),
    })
    .where(eq(agents.id, agentId));

  return NextResponse.json({
    agentId,
    status: newStatus,
    lastSeenAt: isOnline
      ? new Date(now).toISOString()
      : agent.last_seen_at
        ? new Date(agent.last_seen_at).toISOString()
        : null,
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleHealthCheck(id, defaultDb);
}
