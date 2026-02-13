import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  endpoint_url: text("endpoint_url").notNull(),
  icon: text("icon"),
  description: text("description"),
  status: text("status", { enum: ["online", "offline", "unknown"] })
    .notNull()
    .default("unknown"),
  last_seen_at: integer("last_seen_at"),
  config: text("config", { mode: "json" }),
  created_at: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const threads = sqliteTable("threads", {
  id: text("id").primaryKey(),
  agent_id: text("agent_id")
    .notNull()
    .references(() => agents.id),
  title: text("title"),
  status: text("status", { enum: ["active", "completed", "error"] })
    .notNull()
    .default("active"),
  last_activity_at: integer("last_activity_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  created_at: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  thread_id: text("thread_id")
    .notNull()
    .references(() => threads.id),
  agent_id: text("agent_id")
    .notNull()
    .references(() => agents.id),
  status: text("status", {
    enum: ["pending", "running", "completed", "failed", "cancelled"],
  })
    .notNull()
    .default("pending"),
  error: text("error"),
  provider_run_id: text("provider_run_id"),
  metadata: text("metadata", { mode: "json" }),
  started_at: integer("started_at", { mode: "timestamp_ms" }),
  finished_at: integer("finished_at", { mode: "timestamp_ms" }),
  created_at: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  thread_id: text("thread_id")
    .notNull()
    .references(() => threads.id),
  run_id: text("run_id").references(() => runs.id),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  metadata: text("metadata", { mode: "json" }),
  created_at: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
