import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db as defaultDb } from "../../../../db/client";
import { agents, threads, messages, runs } from "../../../../db/schema";
import type {
  DailyDigest,
  DailyDigestMetric,
  DigestAgentRollup,
  DigestItem,
} from "@/types/landing.types";

type Db = typeof defaultDb;

const DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000;
const TOP_ITEM_LIMIT = 6;
const SNIPPET_LIMIT = 130;

function buildWindowStart(now: Date): Date {
  return new Date(now.getTime() - DIGEST_WINDOW_MS);
}

function sanitizeSnippet(value: string | null): string {
  if (!value?.trim()) return "No messages yet";
  return value.length > SNIPPET_LIMIT ? `${value.slice(0, SNIPPET_LIMIT)}…` : value;
}

function sanitizeRole(role: string | null): "user" | "assistant" | "system" | null {
  if (role === "user" || role === "assistant" || role === "system") {
    return role;
  }
  return null;
}

function buildMetric(
  key: DailyDigestMetric["key"],
  label: string,
  value: number
): DailyDigestMetric {
  return { key, label, value };
}

function toDigestItem(row: {
  id: string;
  agent_id: string;
  agent_name: string;
  title: string | null;
  last_message: string | null;
  last_message_role: "user" | "assistant" | "system" | null;
  last_activity_at: Date;
}): DigestItem {
  return {
    threadId: row.id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    subject: row.title || "Untitled conversation",
    snippet: sanitizeSnippet(row.last_message),
    lastMessageRole: sanitizeRole(row.last_message_role),
    lastActivityAt: new Date(row.last_activity_at).toISOString(),
  };
}

function mergeAgentRollup(
  map: Map<string, DigestAgentRollup>,
  row: { agent_id: string; agent_name: string; count: number },
  field: "newThreads" | "agentReplies"
) {
  const existing = map.get(row.agent_id) || {
    agentId: row.agent_id,
    agentName: row.agent_name,
    newThreads: 0,
    agentReplies: 0,
  };

  existing[field] = row.count;
  map.set(row.agent_id, existing);
}

export async function handleGetDigest(
  db: Db = defaultDb,
  now: Date = new Date()
): Promise<NextResponse> {
  const windowEnd = now;
  const windowStart = buildWindowStart(windowEnd);

  try {
    const topThreadRows = await db
      .select({
        id: threads.id,
        agent_id: threads.agent_id,
        title: threads.title,
        last_activity_at: threads.last_activity_at,
        agent_name: agents.name,
      })
      .from(threads)
      .innerJoin(agents, eq(threads.agent_id, agents.id))
      .where(gte(threads.last_activity_at, windowStart))
      .orderBy(desc(threads.last_activity_at))
      .limit(TOP_ITEM_LIMIT);

    const topItems = await Promise.all(
      topThreadRows.map(async (row) => {
        const [messageRow] = await db
          .select({
            content: messages.content,
            role: messages.role,
            created_at: messages.created_at,
          })
          .from(messages)
          .where(eq(messages.thread_id, row.id))
          .orderBy(desc(messages.created_at))
          .limit(1);

        return toDigestItem({
          ...row,
          last_message: messageRow?.content ?? null,
          last_message_role: messageRow?.role ?? null,
          last_activity_at: messageRow?.created_at ?? row.last_activity_at,
        });
      })
    );

    const [newThreadCountRow] = await db
      .select({ value: sql<number>`COUNT(*)`.as("value") })
      .from(threads)
      .where(gte(threads.created_at, windowStart));

    const [activeRunCountRow] = await db
      .select({ value: sql<number>`COUNT(*)`.as("value") })
      .from(runs)
      .where(
        and(
          gte(runs.created_at, windowStart),
          inArray(runs.status, ["pending", "running"] as const)
        )
      );

    const [agentRepliesRow] = await db
      .select({ value: sql<number>`COUNT(*)`.as("value") })
      .from(messages)
      .where(and(gte(messages.created_at, windowStart), eq(messages.role, "assistant")));

    const newThreadsByAgent = await db
      .select({
        agent_id: threads.agent_id,
        agent_name: agents.name,
        count: sql<number>`COUNT(*)`.as("count"),
      })
      .from(threads)
      .innerJoin(agents, eq(threads.agent_id, agents.id))
      .where(gte(threads.created_at, windowStart))
      .groupBy(threads.agent_id, agents.name);

    const replyRollups = await db
      .select({
        agent_id: agents.id,
        agent_name: agents.name,
        count: sql<number>`COUNT(*)`.as("count"),
      })
      .from(messages)
      .innerJoin(threads, eq(messages.thread_id, threads.id))
      .innerJoin(agents, eq(threads.agent_id, agents.id))
      .where(and(gte(messages.created_at, windowStart), eq(messages.role, "assistant")))
      .groupBy(agents.id, agents.name);

    const rollupMap = new Map<string, DigestAgentRollup>();

    newThreadsByAgent.forEach((row) => {
      mergeAgentRollup(
        rollupMap,
        { agent_id: row.agent_id, agent_name: row.agent_name, count: Number(row.count) },
        "newThreads"
      );
    });

    replyRollups.forEach((row) => {
      mergeAgentRollup(
        rollupMap,
        { agent_id: row.agent_id, agent_name: row.agent_name, count: Number(row.count) },
        "agentReplies"
      );
    });

    const agentRollups = Array.from(rollupMap.values())
      .sort((a, b) => b.newThreads + b.agentReplies - (a.newThreads + a.agentReplies))
      .slice(0, 4);

    const digest: DailyDigest = {
      generatedAt: now.toISOString(),
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      metrics: [
        buildMetric("new_threads", "New threads", Number(newThreadCountRow?.value || 0)),
        buildMetric("active_runs", "Active runs", Number(activeRunCountRow?.value || 0)),
        buildMetric("agent_replies", "Agent replies", Number(agentRepliesRow?.value || 0)),
      ],
      topItems,
      agentRollups,
    };

    return NextResponse.json(digest);
  } catch {
    return NextResponse.json({ error: "Unable to load digest" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const now = req.nextUrl.searchParams.get("now");
  const parsedNow = now ? new Date(now) : undefined;
  const safeNow = parsedNow && Number.isFinite(parsedNow.getTime()) ? parsedNow : new Date();
  return handleGetDigest(defaultDb, safeNow);
}
