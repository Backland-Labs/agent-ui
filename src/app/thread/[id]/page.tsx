import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThreadContent } from "./ThreadContent";
import { db } from "../../../../db/client";
import { threads, agents } from "../../../../db/schema";
import { eq } from "drizzle-orm";

interface ThreadPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { id } = await params;

  const thread = await db.select().from(threads).where(eq(threads.id, id)).get();

  if (!thread) notFound();

  const agent = await db.select().from(agents).where(eq(agents.id, thread.agent_id)).get();

  if (!agent) notFound();

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/40 px-4">
        <SidebarTrigger className="-ml-1 text-muted-foreground/50 hover:text-foreground transition-colors" />
        <Separator orientation="vertical" className="mr-2 h-4 bg-border/30" />
        <div className="flex items-center gap-2.5">
          <div className="h-6 w-6 rounded-full bg-accent border border-border/40 text-foreground/60 flex items-center justify-center text-[10px] font-medium">
            {agent.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-sm text-foreground/80">{agent.name}</h1>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <Suspense fallback={<ThreadSkeleton />}>
          <ThreadContent
            threadId={thread.id}
            agent={{
              id: agent.id,
              name: agent.name,
              endpoint_url: agent.endpoint_url,
              icon: agent.icon ?? undefined,
              description: agent.description ?? undefined,
            }}
          />
        </Suspense>
      </main>
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 px-6 py-5 space-y-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="flex gap-3 animate-fade-in-up"
            style={{
              animationDelay: `${i * 80}ms`,
              opacity: 0,
            }}
          >
            <div className="h-7 w-7 rounded-full bg-accent/40" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 rounded-lg bg-accent/30" style={{ width: `${70 - i * 15}%` }} />
              <div className="h-3 rounded-lg bg-accent/20" style={{ width: `${50 - i * 10}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="px-6 py-4">
        <div className="h-14 rounded-2xl bg-accent/20 border border-border/20" />
      </div>
    </div>
  );
}
