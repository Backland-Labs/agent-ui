#!/usr/bin/env bun
/**
 * Production startup script that runs migrations before starting the Next.js server.
 * This ensures the database schema is up-to-date when deploying to Railway or other platforms.
 */

import { spawn } from "bun";

async function runMigrations() {
  console.log("Running database migrations...");
  try {
    const migrate = spawn(["bun", "run", "db:migrate"], {
      stdout: "inherit",
      stderr: "inherit",
    });

    const exitCode = await migrate.exited;
    if (exitCode !== 0) {
      console.error(`Migration failed with exit code ${exitCode}`);
      process.exit(1);
    }
    console.log("Migrations completed successfully.");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
}

async function startServer() {
  console.log("Starting Next.js production server...");
  const server = spawn(["bun", "run", "next", "start"], {
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await server.exited;
  process.exit(exitCode);
}

async function main() {
  await runMigrations();
  await startServer();
}

main().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});
