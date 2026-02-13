import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppLayout } from "@/components/providers";
import { syncAgentsToDb } from "../../db/sync-agents";
import { db } from "../../db/client";
import { agents } from "../../db/schema";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
  // Sync agents from config to DB on every render (cheap upsert)
  await syncAgentsToDb();

  // Load agents from DB (authoritative source after sync)
  const dbAgents = await db.select().from(agents);
  const agentConfigs = dbAgents.map((a) => ({
    id: a.id,
    name: a.name,
    endpoint_url: a.endpoint_url,
    icon: a.icon ?? undefined,
    description: a.description ?? undefined,
  }));

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppLayout agents={agentConfigs}>{children}</AppLayout>
      </body>
    </html>
  );
}
