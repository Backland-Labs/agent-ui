import type { Metadata } from "next";
import { Instrument_Serif, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppLayout } from "@/components/providers";
import { syncAgentsToDb } from "../../db/sync-agents";
import { db } from "../../db/client";
import { agents } from "../../db/schema";

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
    <html lang="en" className="dark">
      <body
        className={`${instrumentSerif.variable} ${outfit.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <AppLayout agents={agentConfigs}>{children}</AppLayout>
      </body>
    </html>
  );
}
