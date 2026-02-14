import type { InferSelectModel } from "drizzle-orm";
import type { agents, threads, messages, runs } from "../../db/schema";

// Calendar types
export type { CalendarEvent, AccountError, CalendarResponse } from "./calendar.types";

// Row types derived from Drizzle schema
export type Agent = InferSelectModel<typeof agents>;
export type Thread = InferSelectModel<typeof threads>;
export type Message = InferSelectModel<typeof messages>;
export type Run = InferSelectModel<typeof runs>;

// Landing page types
export type {
  DailyDigestMetric,
  DigestItem,
  DigestAgentRollup,
  DailyDigest,
  LandingInboxThreadPreview,
} from "./landing.types";

// Denormalized inbox thread (result of threads JOIN agents + last message)
export interface InboxThread {
  id: string;
  agent_id: string;
  title: string | null;
  status: string;
  last_activity_at: Date;
  created_at: Date;
  agent_name: string;
  agent_icon: string | null;
  last_message: string | null;
  last_message_role: string | null;
  last_message_at: Date | null;
}
