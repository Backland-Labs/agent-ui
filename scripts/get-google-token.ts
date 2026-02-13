/**
 * One-time OAuth setup script to obtain Google Calendar refresh tokens.
 *
 * Usage:
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... bun run scripts/get-google-token.ts
 *
 * Run once per Google account. Copy the printed refresh token into .env.
 */

import { OAuth2Client } from "google-auth-library";
import { createServer } from "node:http";
import { URL } from "node:url";
import crypto from "node:crypto";

const PORT = 3001;
const REDIRECT_URI = `http://127.0.0.1:${PORT}`;
const SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Missing required environment variables:");
  if (!clientId) console.error("  GOOGLE_CLIENT_ID");
  if (!clientSecret) console.error("  GOOGLE_CLIENT_SECRET");
  console.error("");
  console.error("Usage:");
  console.error(
    "  GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... bun run scripts/get-google-token.ts"
  );
  process.exit(1);
}

const oauth2Client = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);
const state = crypto.randomBytes(16).toString("hex");

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: SCOPE,
  state,
});

console.log("Opening browser for Google OAuth consent...");
console.log("");
console.log("If the browser does not open, visit this URL manually:");
console.log(authUrl);
console.log("");

// Open browser
const openModule = await import("open");
await openModule.default(authUrl);

// Start temporary server to capture the callback
const server = createServer(async (req, res) => {
  const url = new URL(req.url!, `http://127.0.0.1:${PORT}`);

  if (url.pathname !== "/") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    const safeError = error.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(`<h1>Authorization failed</h1><p>${safeError}</p>`);
    console.error(`Authorization failed: ${error}`);
    server.close();
    process.exit(1);
  }

  if (returnedState !== state) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end("<h1>Invalid state parameter</h1>");
    console.error("State parameter mismatch -- possible CSRF attack.");
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end("<h1>No authorization code received</h1>");
    server.close();
    process.exit(1);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h1>Success!</h1><p>You can close this tab and return to the terminal.</p>");

    console.log("=".repeat(60));
    console.log("Refresh token obtained successfully!");
    console.log("=".repeat(60));
    console.log("");
    console.log("Add this to your .env file:");
    console.log("");
    console.log(`GOOGLE_REFRESH_TOKEN_X=${tokens.refresh_token}`);
    console.log("");
    console.log("(Replace X with 1 or 2 depending on which account this is)");
    console.log("=".repeat(60));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end("<h1>Token exchange failed</h1>");
    console.error("Failed to exchange code for tokens:", err);
  } finally {
    server.close();
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Listening on http://127.0.0.1:${PORT} for OAuth callback...`);
});
