import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db as defaultDb } from "../../../../../db/client";
import { agents, threads } from "../../../../../db/schema";

type Db = typeof defaultDb;

export async function handleGetThread(db: Db = defaultDb, threadId: string): Promise<NextResponse> {
  const row = await db
    .select({
      id: threads.id,
      agent_id: threads.agent_id,
      title: threads.title,
      status: threads.status,
      last_activity_at: threads.last_activity_at,
      created_at: threads.created_at,
      updated_at: threads.updated_at,
      agent_name: agents.name,
      agent_icon: agents.icon,
    })
    .from(threads)
    .innerJoin(agents, eq(threads.agent_id, agents.id))
    .where(eq(threads.id, threadId))
    .get();

  if (!row) {
    return NextResponse.json({ error: `Thread '${threadId}' not found` }, { status: 404 });
  }

  return NextResponse.json(row);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleGetThread(defaultDb, id);
}
