import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div className="flex items-center gap-2.5">
          <div className="h-6 w-6 rounded bg-foreground text-background flex items-center justify-center text-[10px] font-medium">
            {agent.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-sm font-medium">{agent.name}</h1>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <Suspense fallback={<ThreadSkeleton />}>
          <ThreadContent threadId={thread.id} agent={agent} />
        </Suspense>
      </main>
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 px-6 py-5 space-y-5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-16 flex-1 rounded-2xl" />
          </div>
        ))}
      </div>
      <div className="border-t px-6 py-4">
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}
