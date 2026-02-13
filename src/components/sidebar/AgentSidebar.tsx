"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NewThreadDialog } from "./NewThreadDialog";
import { cn } from "@/lib/utils";
import type { AgentConfig, AgentStatus } from "@/lib/agents/types";

interface AgentSidebarProps {
  agents: AgentConfig[];
}

export function AgentSidebar({ agents }: AgentSidebarProps) {
  const pathname = usePathname();
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>({});

  useEffect(() => {
    async function checkHealth() {
      const results = await Promise.allSettled(
        agents.map(async (agent) => {
          const res = await fetch(`/api/agents/${agent.id}/health`);
          if (!res.ok) return { id: agent.id, status: "offline" as AgentStatus };
          const data = await res.json();
          return { id: agent.id, status: (data.status as AgentStatus) || "unknown" };
        })
      );

      const newStatuses: Record<string, AgentStatus> = {};
      for (const result of results) {
        if (result.status === "fulfilled") {
          newStatuses[result.value.id] = result.value.status;
        }
      }
      setStatuses(newStatuses);
    }

    checkHealth();
  }, [agents]);

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <span className="font-serif italic text-base tracking-tight text-foreground">
            agent ui
          </span>
          <div className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-breathe" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/inbox"}>
                  <Link href="/inbox">
                    <Inbox className="h-4 w-4" />
                    <span>Inbox</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Agents
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {agents.map((agent) => {
                const agentStatus: AgentStatus =
                  (agent as { status?: AgentStatus }).status || statuses[agent.id] || "unknown";
                return (
                  <SidebarMenuItem key={agent.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/inbox?agent=${agent.id}`}
                      tooltip={agent.description}
                    >
                      <Link href={`/inbox?agent=${agent.id}`}>
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full shrink-0 transition-all duration-500",
                            agentStatus === "online" &&
                              "bg-emerald-400 shadow-[0_0_6px_1px] shadow-emerald-400/50",
                            agentStatus === "offline" &&
                              "bg-destructive/80 shadow-[0_0_6px_1px] shadow-destructive/30",
                            agentStatus === "unknown" && "bg-muted-foreground/30"
                          )}
                        />
                        <span>{agent.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <NewThreadDialog agents={agents} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
