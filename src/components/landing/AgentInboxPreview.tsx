"use client";

import type { ComponentPropsWithoutRef } from "react";
import Link from "next/link";
import { RefreshCw, MailOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { LandingNarrativeState } from "@/types";

interface AgentInboxPreviewProps {
  narrative: string;
  actionItems: string[];
  state: LandingNarrativeState;
  terminalError: string | null;
  refreshError: string | null;
  isRefreshing: boolean;
  refresh: () => void;
}

const NARRATIVE_FALLBACK = "No narrative details returned.";
const SAFE_REL = "noopener noreferrer nofollow ugc";
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

function getSafeNarrativeHref(href: string | undefined): string | null {
  if (!href) {
    return null;
  }

  const trimmedHref = href.trim();
  if (!trimmedHref) {
    return null;
  }

  if (trimmedHref.startsWith("#")) {
    return trimmedHref;
  }

  if (trimmedHref.startsWith("//")) {
    return null;
  }

  const normalized = trimmedHref.replace(/[\u0000-\u001F\u007F\s]+/g, "");
  const protocolMatch = normalized.match(/^([a-zA-Z][a-zA-Z\d+.-]*):/);

  if (!protocolMatch) {
    return trimmedHref;
  }

  const protocol = `${protocolMatch[1].toLowerCase()}:`;
  if (!SAFE_PROTOCOLS.has(protocol)) {
    return null;
  }

  return trimmedHref;
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function NarrativeLink({
  href,
  children,
  ...props
}: ComponentPropsWithoutRef<"a"> & { node?: unknown }) {
  const safeHref = getSafeNarrativeHref(href);

  if (!safeHref) {
    return <span className="text-muted-foreground/75">{children}</span>;
  }

  const external = isExternalHref(safeHref);

  return (
    <a
      {...props}
      href={safeHref}
      target={external ? "_blank" : undefined}
      rel={external ? SAFE_REL : undefined}
    >
      {children}
    </a>
  );
}

function NarrativeMarkdown({ narrative }: { narrative: string }) {
  return (
    <div className="mt-1 text-xs leading-relaxed text-foreground/85 [&_a]:font-medium [&_a]:text-primary/80 [&_a]:underline [&_a]:decoration-primary/50 [&_a]:underline-offset-2 [&_a:hover]:text-primary [&_code]:rounded [&_code]:bg-accent/35 [&_code]:px-1 [&_code]:py-0.5 [&_h1]:mb-1 [&_h1]:mt-2 [&_h1]:text-sm [&_h1]:font-semibold [&_h1:first-child]:mt-0 [&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2:first-child]:mt-0 [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:font-semibold [&_h3:first-child]:mt-0 [&_li]:leading-relaxed [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-4 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-accent/25 [&_pre]:p-2 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        disallowedElements={["img"]}
        unwrapDisallowed={true}
        components={{
          a: NarrativeLink,
        }}
      >
        {narrative}
      </ReactMarkdown>
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(4)].map((_, index) => (
        <div
          key={index}
          className="flex gap-2 items-start animate-fade-in-up"
          style={{ animationDelay: `${index * 70}ms` }}
        >
          <div className="h-8 w-8 rounded-full bg-accent/45" />
          <div className="flex-1 space-y-1">
            <div className="h-3 rounded bg-accent/35" style={{ width: `${70 - index * 10}%` }} />
            <div className="h-2 rounded bg-accent/25" style={{ width: `${50 - index * 7}%` }} />
            <div className="h-2 rounded bg-accent/20" style={{ width: `${90 - index * 8}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AgentInboxPreview({
  narrative,
  actionItems,
  state,
  terminalError,
  refreshError,
  isRefreshing,
  refresh,
}: AgentInboxPreviewProps) {
  const hasNarrative = narrative.trim().length > 0;
  const hasActionItems = actionItems.length > 0;

  return (
    <section className="rounded-xl border border-border/30 bg-card/60 flex-1 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Email Narrative</h2>
          <p className="font-mono text-[10px] text-muted-foreground/65">
            Latest narrative brief and action items from the email agent
          </p>
        </div>
        <button
          onClick={refresh}
          type="button"
          disabled={state === "initial_loading" || isRefreshing}
          className="flex items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          <RefreshCw className={isRefreshing ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {refreshError ? (
        <div className="mb-3 flex items-center justify-between rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <span>{refreshError}</span>
          <button
            onClick={refresh}
            type="button"
            className="font-medium text-destructive/90 hover:text-destructive transition-colors"
          >
            Retry
          </button>
        </div>
      ) : null}

      {state === "initial_loading" ? <ThreadSkeleton /> : null}
      {state === "initial_loading" ? (
        <p className="mt-2 text-xs text-muted-foreground/60">Loading email narrative...</p>
      ) : null}

      {state === "terminal_error" && terminalError ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {terminalError}
        </div>
      ) : null}

      {state === "empty" ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-border/20 bg-accent/10 py-8 text-center px-2">
          <MailOpen className="h-5 w-5 text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground/60">All caught up.</p>
          <p className="text-[11px] text-muted-foreground/50 mt-1">
            No recent items to triage from the email agent.
          </p>
        </div>
      ) : null}

      {state === "success" ? (
        <div className="space-y-3">
          <div className="rounded-md border border-border/20 bg-accent/10 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/75">
              Narrative
            </p>
            {hasNarrative ? (
              <NarrativeMarkdown narrative={narrative} />
            ) : (
              <p className="mt-1 text-xs leading-relaxed text-foreground/85">
                {NARRATIVE_FALLBACK}
              </p>
            )}
          </div>

          <div className="rounded-md border border-border/20 bg-card/70 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/75">
              Action Items
            </p>

            {hasActionItems ? (
              <ul className="mt-1 space-y-1 text-xs text-foreground/85">
                {actionItems.map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary/70" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground/65">No immediate action items.</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-3">
        <Link
          href="/inbox"
          className="text-[11px] font-medium text-primary/80 hover:text-primary transition-colors"
        >
          Open full inbox →
        </Link>
      </div>
    </section>
  );
}
