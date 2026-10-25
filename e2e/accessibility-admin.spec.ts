import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createTestEvent, getModeratorSessionToken, newConvexClient } from "./testSetup";

async function loginAsModerator(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("e2e-mod@example.com");
  await page.getByLabel("Password").fill("e2e-test-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/admin\/events/);
}

test.describe("Polish: admin accessibility (FR-036)", () => {
  test("every admin screen passes an automated axe scan and the events form is keyboard operable", async ({
    page,
  }) => {
    const client = newConvexClient();
    await getModeratorSessionToken(client);
    const { eventId } = await createTestEvent(client, `A11y admin ${Date.now()}`);

    await loginAsModerator(page);

    const eventsScan = await new AxeBuilder({ page }).analyze();
    expect(eventsScan.violations).toEqual([]);

    // Keyboard-only: create a second event from the Events screen.
    const keyboardEventName = `Keyboard-created event ${Date.now()}`;
    await page.getByLabel("New event name").focus();
    await page.keyboard.type(keyboardEventName);
    await page.keyboard.press("Enter");
    await expect(page.getByText(keyboardEventName)).toBeVisible();

    await page.goto(`/admin/events/${eventId}/moderation`);
    const moderationScan = await new AxeBuilder({ page }).analyze();
    expect(moderationScan.violations).toEqual([]);

    await page.goto(`/admin/events/${eventId}/polls`);
    const pollsScan = await new AxeBuilder({ page }).analyze();
    expect(pollsScan.violations).toEqual([]);

    await page.goto(`/admin/events/${eventId}/export`);
    const exportScan = await new AxeBuilder({ page }).analyze();
    expect(exportScan.violations).toEqual([]);
  });
});
