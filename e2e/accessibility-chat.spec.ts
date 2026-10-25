import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createTestEvent, newConvexClient } from "./testSetup";

test.describe("US1: accessibility (FR-036)", () => {
  test("join and chat flow is keyboard operable and passes an automated axe scan", async ({
    page,
  }) => {
    const client = newConvexClient();
    const { joinSlug } = await createTestEvent(client, `Accessibility ${Date.now()}`);

    await page.goto(`/join/${joinSlug}`);
    const joinScan = await new AxeBuilder({ page }).analyze();
    expect(joinScan.violations).toEqual([]);

    // Keyboard-only: the name field autofocuses on load, so typing works immediately.
    await expect(page.getByLabel("Your name")).toBeFocused();
    await page.keyboard.type("Keyboard Person");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(new RegExp(`/chat/${joinSlug}`));

    // Keyboard-only: focus the composer directly and send a message.
    await page.getByLabel("Type a message").focus();
    await page.keyboard.type("Sent via keyboard only");
    await page.keyboard.press("Enter");

    await expect(page.getByText("Sent via keyboard only")).toBeVisible();

    const chatScan = await new AxeBuilder({ page }).analyze();
    expect(chatScan.violations).toEqual([]);
  });
});
