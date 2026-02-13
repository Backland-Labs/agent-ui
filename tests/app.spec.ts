import { test, expect } from "@playwright/test";

// Helper to create a thread via API and return its id
async function createThread(
  request: import("@playwright/test").APIRequestContext,
  agentId = "mock-assistant"
): Promise<string> {
  const res = await request.post("/api/threads", {
    data: { agentId, title: "New conversation" },
  });
  expect(res.ok()).toBe(true);
  const thread = await res.json();
  return thread.id;
}

test.describe("Basic navigation", () => {
  test("should load inbox page", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/inbox/);
  });

  test("should display sidebar with app name", async ({ page }) => {
    await page.goto("/inbox");

    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText("Agent UI")).toBeVisible({ timeout: 10000 });
  });

  test("should display agents in sidebar", async ({ page }) => {
    await page.goto("/inbox");

    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar.getByText("Mock Assistant")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should have New Thread button", async ({ page }) => {
    await page.goto("/inbox");

    // The sidebar footer contains a "New Thread" button (NewThreadDialog)
    await expect(page.getByRole("button", { name: /New Thread/i })).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Thread creation and messaging", () => {
  test("should create a new thread and navigate to it", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    // Click the "New Thread" button in the sidebar footer to open the dialog
    await page.getByRole("button", { name: /New Thread/i }).click();

    // The dialog should appear with "New conversation" title
    await expect(page.getByText("New conversation")).toBeVisible({
      timeout: 5000,
    });

    // The select should already default to the first agent (Mock Assistant).
    // Open the select and choose Mock Assistant to be explicit.
    const selectTrigger = page
      .locator('[role="dialog"]')
      .locator("button", { hasText: /Mock Assistant|Select an agent/i });
    await selectTrigger.click();
    await page.getByRole("option", { name: /Mock Assistant/i }).click();

    // Click "Start" to create the thread
    await page.getByRole("button", { name: /Start/i }).click();

    // Should navigate to /thread/<uuid>
    await page.waitForURL(/\/thread\/[a-f0-9-]+/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/thread\/[a-f0-9-]+/);

    // The thread page header should show the agent name
    const header = page.locator("header");
    await expect(header.getByText("Mock Assistant")).toBeVisible({
      timeout: 10000,
    });

    // The chat input should be visible with the agent-specific placeholder
    await expect(page.getByPlaceholder("Message Mock Assistant...")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should send a message and receive a response", async ({ page, request }) => {
    // Create a thread via API
    const threadId = await createThread(request);

    // Navigate to the thread
    await page.goto(`/thread/${threadId}`);
    await page.waitForLoadState("networkidle");

    // Wait for the chat input to be ready
    const chatInput = page.getByPlaceholder("Message Mock Assistant...");
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Type a message and send it
    await chatInput.fill("Hello");
    await page.getByRole("button", { name: "Send message" }).click();

    // The user message should appear
    await expect(page.getByText("Hello")).toBeVisible({ timeout: 5000 });

    // Wait for the assistant response to stream in.
    // The mock agent responds to "hello" with a predictable message.
    await expect(page.getByText("Hello! I'm a mock AI assistant", { exact: false })).toBeVisible({
      timeout: 15000,
    });
  });

  test("should persist messages across page reload", async ({ page, request }) => {
    // Create a thread via API
    const threadId = await createThread(request);

    // Navigate to the thread and send a message
    await page.goto(`/thread/${threadId}`);
    await page.waitForLoadState("networkidle");

    const chatInput = page.getByPlaceholder("Message Mock Assistant...");
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    await chatInput.fill("Hello");
    await page.getByRole("button", { name: "Send message" }).click();

    // Wait for the full assistant response
    await expect(page.getByText("Hello! I'm a mock AI assistant", { exact: false })).toBeVisible({
      timeout: 15000,
    });

    // Reload the page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Messages should still be visible after reload (loaded from DB)
    await expect(page.getByText("Hello")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Hello! I'm a mock AI assistant", { exact: false })).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("Inbox functionality", () => {
  test("should show threads in inbox", async ({ page, request }) => {
    // Create a thread via API
    const threadId = await createThread(request);

    // Navigate to the inbox
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    // The thread should appear in the inbox list.
    // Threads are rendered as links to /thread/<id> with the title "New conversation".
    const threadLink = page.locator(`a[href="/thread/${threadId}"]`);
    await expect(threadLink).toBeVisible({ timeout: 10000 });

    // The thread item should display the agent name
    await expect(page.getByText("Mock Assistant")).toBeVisible({
      timeout: 10000,
    });
  });
});
