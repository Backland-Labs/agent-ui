import { NextRequest, NextResponse } from "next/server";
import { eq, desc, sql } from "drizzle-orm";
import { db as defaultDb } from "../../../../db/client";
import { agents, threads, messages } from "../../../../db/schema";
import type { InboxThread } from "@/types";

type Db = typeof defaultDb;

export async function handleGetThreads(
  db: Db = defaultDb,
  agentFilter?: string
): Promise<NextResponse> {
  // Subquery: get the latest message per thread
  const lastMessageSubquery = db
    .select({
      thread_id: messages.thread_id,
      content: messages.content,
      role: messages.role,
      created_at: sql<number>`MAX(${messages.created_at})`.as("last_msg_created_at"),
    })
    .from(messages)
    .groupBy(messages.thread_id)
    .as("last_msg");

  let query = db
    .select({
      id: threads.id,
      agent_id: threads.agent_id,
      title: threads.title,
      status: threads.status,
      last_activity_at: threads.last_activity_at,
      created_at: threads.created_at,
      agent_name: agents.name,
      agent_icon: agents.icon,
      last_message: lastMessageSubquery.content,
      last_message_role: lastMessageSubquery.role,
      last_message_at: lastMessageSubquery.created_at,
    })
    .from(threads)
    .innerJoin(agents, eq(threads.agent_id, agents.id))
    .leftJoin(lastMessageSubquery, eq(threads.id, lastMessageSubquery.thread_id))
    .orderBy(desc(threads.last_activity_at))
    .$dynamic();

  if (agentFilter) {
    query = query.where(eq(threads.agent_id, agentFilter));
  }

  const rows = await query;

  const result: InboxThread[] = rows.map((row) => ({
    id: row.id,
    agent_id: row.agent_id,
    title: row.title,
    status: row.status,
    last_activity_at: row.last_activity_at,
    created_at: row.created_at,
    agent_name: row.agent_name,
    agent_icon: row.agent_icon,
    last_message: row.last_message ?? null,
    last_message_role: row.last_message_role ?? null,
    last_message_at: row.last_message_at ? new Date(row.last_message_at) : null,
  }));

  return NextResponse.json(result);
}

export async function handlePostThread(
  db: Db = defaultDb,
  body: { agentId?: string; title?: string }
): Promise<NextResponse> {
  const { agentId, title } = body;

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  // Verify agent exists
  const agent = await db.select().from(agents).where(eq(agents.id, agentId)).get();

  if (!agent) {
    return NextResponse.json({ error: `Agent '${agentId}' not found` }, { status: 404 });
  }

  const now = new Date();
  const newThread = {
    id: crypto.randomUUID(),
    agent_id: agentId,
    title: title ?? null,
    status: "active" as const,
    last_activity_at: now,
    created_at: now,
    updated_at: now,
  };

  await db.insert(threads).values(newThread);

  return NextResponse.json(newThread, { status: 201 });
}

export async function GET(req: NextRequest) {
  const agentFilter = req.nextUrl.searchParams.get("agent") ?? undefined;
  return handleGetThreads(defaultDb, agentFilter);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return handlePostThread(defaultDb, body);
}
