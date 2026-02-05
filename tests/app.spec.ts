import { test, expect } from "@playwright/test";

test.describe("Agent UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/inbox");
    // Wait for hydration - look for any interactive element
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000); // Give time for React hydration
  });

  test("should load inbox page", async ({ page }) => {
    await expect(page).toHaveURL(/.*inbox/);
  });

  test("should display sidebar with app name", async ({ page }) => {
    // Check sidebar is visible
    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar).toBeVisible();

    // Check for Bot icon or Agent UI text
    await expect(sidebar.getByText("Agent UI")).toBeVisible({ timeout: 10000 });
  });

  test("should display agents in sidebar", async ({ page }) => {
    const sidebar = page.locator('[data-slot="sidebar"]');

    // Check agents are listed
    await expect(sidebar.getByText("Mock Assistant")).toBeVisible({ timeout: 10000 });
    await expect(sidebar.getByText("Claude Coder")).toBeVisible({ timeout: 10000 });
  });

  test("should have inbox link in sidebar", async ({ page }) => {
    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar.getByText("Inbox")).toBeVisible({ timeout: 10000 });
  });

  test("should display inbox header", async ({ page }) => {
    // Look for the header in the main content area
    const header = page.locator("header");
    await expect(header.getByText("Inbox")).toBeVisible({ timeout: 10000 });
  });

  test("should have New Thread button", async ({ page }) => {
    // Wait for the button to be visible
    await expect(page.getByRole("button", { name: /New Thread/i })).toBeVisible({ timeout: 10000 });
  });

  test("should show threads count text", async ({ page }) => {
    // Wait for mock data to load (500ms timeout in component + buffer)
    await page.waitForTimeout(1500);

    // Check that we see the conversation count (indicates mock data loaded)
    await expect(page.getByText(/conversation/i)).toBeVisible({ timeout: 10000 });
  });

  test("should show All Threads heading", async ({ page }) => {
    // Wait for content to render
    await page.waitForTimeout(1000);

    // Check for the All Threads heading
    await expect(page.getByText("All Threads")).toBeVisible({ timeout: 10000 });
  });

  test("capture screenshot for debugging", async ({ page }) => {
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/debug-screenshot.png", fullPage: true });

    // Log the page content
    const content = await page.content();
    console.log("Page has sidebar:", content.includes("sidebar"));
    console.log("Page has Agent UI:", content.includes("Agent UI"));
    console.log("Page has All Threads:", content.includes("All Threads"));

    // This test always passes - it's just for debugging
    expect(true).toBe(true);
  });
});
