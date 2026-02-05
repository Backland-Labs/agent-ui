"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AgentSidebar } from "@/components/sidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { AgentConfig } from "@/lib/agents/types";

interface AppLayoutProps {
  children: React.ReactNode;
  agents: AgentConfig[];
}

export function AppLayout({ children, agents }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <AgentSidebar agents={agents} />
      <SidebarInset>
        <ErrorBoundary>{children}</ErrorBoundary>
      </SidebarInset>
    </SidebarProvider>
  );
}
