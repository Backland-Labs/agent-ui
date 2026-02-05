import { Suspense } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { InboxContent } from "@/components/inbox/InboxContent";
import { loadAgentsConfig } from "@/lib/agents";

export default function InboxPage() {
  const agents = loadAgentsConfig();

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-sm font-medium">Inbox</h1>
      </header>
      <main className="flex-1 overflow-hidden">
        <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
          <InboxContent agents={agents} />
        </Suspense>
      </main>
    </div>
  );
}
