import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db as defaultDb } from "../../../../db/client";
import { agents } from "../../../../db/schema";
import { syncAgentsToDb } from "../../../../db/sync-agents";
import { logger } from "@/lib/server/logger";
import type { LandingNarrativeItem, LandingNarrativeResponse } from "@/types";

type Db = typeof defaultDb;
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const EMAIL_AGENT_ID = "email-agent";
const NARRATIVE_PATH = "/narrative";
const SNIPPET_LIMIT = 140;
const PREVIEW_LIMIT = 7;
const EPOCH_ISO = "1970-01-01T00:00:00.000Z";

const SSE_SEPARATOR_REGEX = /\r?\n\r?\n/;
const SSE_LINE_REGEX = /\r?\n/;

function toNarrativeEndpoint(endpointUrl: string): string {
  const normalizedEndpoint = endpointUrl.replace(/\/$/, "");
  const serviceRoot = normalizedEndpoint.replace(/\/agent$/, "");
  return `${serviceRoot}${NARRATIVE_PATH}`;
}

function sanitizeSnippet(value: string | null | undefined): string {
  if (!value?.trim()) {
    return "No messages yet";
  }

  return value.length > SNIPPET_LIMIT ? `${value.slice(0, SNIPPET_LIMIT)}…` : value;
}

function tryParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function hasRecordPayload(value: unknown): boolean {
  if (Array.isArray(value)) {
    return true;
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return Array.isArray(record.items) || Array.isArray(record.data);
}

function getNestedCandidates(value: unknown): unknown[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const keys = ["data", "result", "runResult", "payload", "output"];
  const nested: unknown[] = [];

  for (const key of keys) {
    const candidate = record[key];

    if (candidate === undefined) {
      continue;
    }

    nested.push(candidate);

    if (typeof candidate === "string") {
      const parsed = tryParseJson(candidate);
      if (parsed !== null) {
        nested.push(parsed);
      }
    }
  }

  return nested;
}

function extractSseCandidates(bodyText: string): unknown[] {
  const candidates: unknown[] = [];

  for (const chunk of bodyText.split(SSE_SEPARATOR_REGEX)) {
    if (!chunk.trim()) {
      continue;
    }

    const dataLines = chunk
      .split(SSE_LINE_REGEX)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart());

    if (dataLines.length === 0) {
      continue;
    }

    const parsedData = tryParseJson(dataLines.join("\n"));
    if (parsedData === null) {
      continue;
    }

    candidates.push(parsedData, ...getNestedCandidates(parsedData));
  }

  return candidates;
}

function extractNarrativePayload(bodyText: string): unknown {
  const trimmed = bodyText.trim();

  if (!trimmed) {
    return [];
  }

  const directJson = tryParseJson(trimmed);
  if (directJson !== null) {
    return directJson;
  }

  for (const candidate of extractSseCandidates(trimmed)) {
    if (hasRecordPayload(candidate)) {
      return candidate;
    }
  }

  return [];
}

function sanitizeRole(role: string | null | undefined): "user" | "assistant" | "system" | null {
  if (role === "user" || role === "assistant" || role === "system") {
    return role;
  }

  return null;
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return undefined;
}

function pickDateIso(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      const parsed = new Date(value);
      if (Number.isFinite(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
    if (typeof value === "number") {
      const parsed = new Date(value);
      if (Number.isFinite(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }

  return EPOCH_ISO;
}

function getRecordPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    if (Array.isArray((payload as { items?: unknown[] }).items)) {
      return (payload as { items?: unknown[] }).items as unknown[];
    }

    if (Array.isArray((payload as { data?: unknown[] }).data)) {
      return (payload as { data?: unknown[] }).data as unknown[];
    }
  }

  return [];
}

function toNarrativeItem(record: unknown): LandingNarrativeItem | null {
  if (!record || typeof record !== "object") {
    return null;
  }

  const value = record as Record<string, unknown>;
  const threadId = pickString(value, ["threadId", "thread_id", "id", "thread"])?.trim() ?? null;

  if (!threadId) {
    return null;
  }

  return {
    threadId,
    agentName:
      pickString(value, ["agentName", "agent_name", "agent", "source", "source_name"]) ||
      "Email Agent",
    title: pickString(value, ["title", "subject", "name", "threadTitle"]) || "Untitled narrative",
    snippet: sanitizeSnippet(
      pickString(value, ["snippet", "summary", "text", "message", "body", "content"])
    ),
    lastActivityAt: pickDateIso(value, [
      "lastActivityAt",
      "last_activity_at",
      "updatedAt",
      "updated_at",
      "createdAt",
      "created_at",
      "timestamp",
      "time",
    ]),
    lastMessageRole: sanitizeRole(
      pickString(value, ["lastMessageRole", "last_message_role"]) as string | undefined
    ),
  };
}

function compareByRecency(a: LandingNarrativeItem, b: LandingNarrativeItem): number {
  const timestampDiff = new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();

  if (timestampDiff !== 0) {
    return timestampDiff;
  }

  return a.threadId.localeCompare(b.threadId);
}

function mapItems(payload: unknown): LandingNarrativeItem[] {
  return getRecordPayload(payload)
    .map(toNarrativeItem)
    .filter((value): value is LandingNarrativeItem => value !== null)
    .sort(compareByRecency)
    .slice(0, PREVIEW_LIMIT);
}

export async function handleGetNarrative(
  db: Db = defaultDb,
  fetcher: Fetcher = fetch
): Promise<NextResponse> {
  const startedAt = Date.now();
  const log = logger.child({
    requestId: crypto.randomUUID(),
    route: "/api/narrative",
    agentId: EMAIL_AGENT_ID,
  });

  log.info({ event: "narrative.started" }, "narrative request started");

  try {
    const [configuredAgent] = await db
      .select({
        endpointUrl: agents.endpoint_url,
        name: agents.name,
      })
      .from(agents)
      .where(eq(agents.id, EMAIL_AGENT_ID));

    if (!configuredAgent?.endpointUrl) {
      log.warn(
        {
          event: "narrative.source_unavailable",
          durationMs: Date.now() - startedAt,
        },
        "email narrative source unavailable"
      );

      return NextResponse.json({ error: "Email narrative source unavailable" }, { status: 404 });
    }

    const endpoint = toNarrativeEndpoint(configuredAgent.endpointUrl);

    const response = await fetcher(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{}",
    });

    if (!response.ok) {
      log.error(
        {
          event: "narrative.upstream_failed",
          durationMs: Date.now() - startedAt,
          upstreamStatus: response.status,
        },
        "narrative upstream request failed"
      );

      return NextResponse.json({ error: "Unable to load email narrative" }, { status: 502 });
    }

    const bodyText = await response.text();
    const items = mapItems(extractNarrativePayload(bodyText));

    const responseBody: LandingNarrativeResponse = {
      items,
    };

    log.info(
      {
        event: "narrative.completed",
        durationMs: Date.now() - startedAt,
        itemCount: items.length,
      },
      "narrative request completed"
    );

    return NextResponse.json(responseBody);
  } catch (error) {
    log.error(
      {
        event: "narrative.failed",
        durationMs: Date.now() - startedAt,
        err: error,
      },
      "narrative request failed"
    );

    return NextResponse.json({ error: "Unable to load email narrative" }, { status: 500 });
  }
}

export async function GET() {
  await syncAgentsToDb(defaultDb);
  return handleGetNarrative(defaultDb, fetch);
}
