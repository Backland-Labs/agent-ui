import { NextResponse } from "next/server";
import { db as defaultDb } from "../../../../db/client";
import { agents } from "../../../../db/schema";

type Db = typeof defaultDb;

export async function handleGetAgents(db: Db = defaultDb): Promise<NextResponse> {
  const rows = await db.select().from(agents);
  return NextResponse.json(rows);
}

export async function GET() {
  return handleGetAgents(defaultDb);
}
