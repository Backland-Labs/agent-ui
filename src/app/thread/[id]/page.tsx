import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ThreadContent } from "./ThreadContent";
import { loadAgentsConfig, getAgentById } from "@/lib/agents";

interface ThreadPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    agent?: string;
  }>;
}

export default async function ThreadPage({ params, searchParams }: ThreadPageProps) {
  const { id } = await params;
  const { agent: agentId } = await searchParams;
  const agents = loadAgentsConfig();

  // For new threads, use the agent query param; for existing threads, we'd fetch from DB
  // For now, default to first agent if no agent specified
  const agent = agentId ? getAgentById(agentId) : agents[0];

  if (!agent) {
    notFound();
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div className="flex items-center gap-2">
          <span className="text-xl">{agent.icon || "🤖"}</span>
          <div>
            <h1 className="font-semibold">{agent.name}</h1>
            <p className="text-xs text-muted-foreground">{agent.description}</p>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <Suspense fallback={<ThreadSkeleton />}>
          <ThreadContent threadId={id} agent={agent} />
        </Suspense>
      </main>
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-20 flex-1 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="border-t p-4">
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}
