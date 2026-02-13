import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db as defaultDb } from "../../../../../../db/client";
import { threads, messages } from "../../../../../../db/schema";

type Db = typeof defaultDb;

export async function handleGetMessages(
  db: Db = defaultDb,
  threadId: string
): Promise<NextResponse> {
  // Verify thread exists
  const thread = await db
    .select({ id: threads.id })
    .from(threads)
    .where(eq(threads.id, threadId))
    .get();

  if (!thread) {
    return NextResponse.json({ error: `Thread '${threadId}' not found` }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.thread_id, threadId))
    .orderBy(asc(messages.created_at));

  return NextResponse.json(rows);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleGetMessages(defaultDb, id);
}
