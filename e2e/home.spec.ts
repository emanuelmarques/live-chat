import { test, expect } from "@playwright/test";
import { createTestEvent, newConvexClient } from "./testSetup";

test.describe("Public home page: enter code fallback for an unreadable QR code", () => {
  test("typing the event code on the home page leads to the join form for that event", async ({
    page,
  }) => {
    const client = newConvexClient();
    const name = `Home code ${Date.now()}`;
    const { joinSlug } = await createTestEvent(client, name);

    await page.goto("/");
    await page.getByLabel("Event code").fill(joinSlug.toLowerCase()); // typed lowercase on purpose
    await page.getByRole("button", { name: "Join" }).click();

    await expect(page).toHaveURL(new RegExp(`/join/${joinSlug.toLowerCase()}`));
    await expect(page.getByRole("heading", { name })).toBeVisible();
  });

  test("an unknown code shows a clear not-found state instead of a crash", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Event code").fill("ZZZZZZ");
    await page.getByRole("button", { name: "Join" }).click();
    await expect(page.getByText(/couldn't find this event/i)).toBeVisible();
  });
});
