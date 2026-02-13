"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, CircleDot } from "lucide-react";
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
import type { AgentConfig } from "@/lib/agents/types";

interface AgentSidebarProps {
  agents: AgentConfig[];
}

export function AgentSidebar({ agents }: AgentSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="font-mono text-xs font-semibold uppercase tracking-widest text-foreground">
            Agent UI
          </span>
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
          <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Agents
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {agents.map((agent) => (
                <SidebarMenuItem key={agent.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === `/inbox?agent=${agent.id}`}
                    tooltip={agent.description}
                  >
                    <Link href={`/inbox?agent=${agent.id}`}>
                      <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{agent.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
