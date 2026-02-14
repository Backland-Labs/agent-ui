import type { Metadata } from "next";
import { Instrument_Serif, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppLayout } from "@/components/providers";
import { syncAgentsToDb } from "../../db/sync-agents";
import { db } from "../../db/client";
import { agents } from "../../db/schema";
import { loadAgentsConfig } from "@/lib/agents";
import { logger } from "@/lib/server/logger";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agent UI",
  description: "Multi-agent inbox for AI assistants",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Sync agents from config to DB and load from DB.
  // Falls back to the static config file when the DB is unavailable
  // (e.g. during next build prerendering before migrations have run).
  let agentConfigs: {
    id: string;
    name: string;
    endpoint_url: string;
    icon?: string;
    description?: string;
  }[];
  try {
    await syncAgentsToDb();
    const dbAgents = await db.select().from(agents);
    agentConfigs = dbAgents.map((a) => ({
      id: a.id,
      name: a.name,
      endpoint_url: a.endpoint_url,
      icon: a.icon ?? undefined,
      description: a.description ?? undefined,
    }));
  } catch (error) {
    logger.warn({ event: "layout.agent_sync_failed", err: error }, "agent sync failed");
    agentConfigs = loadAgentsConfig().map((a) => ({
      id: a.id,
      name: a.name,
      endpoint_url: a.endpoint_url,
      icon: a.icon ?? undefined,
      description: a.description ?? undefined,
    }));
  }

  return (
    <html lang="en">
      <body
        className={`${instrumentSerif.variable} ${outfit.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <AppLayout agents={agentConfigs}>{children}</AppLayout>
      </body>
    </html>
  );
}
