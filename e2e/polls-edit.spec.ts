import { test, expect } from "@playwright/test";
import { createTestEvent, getModeratorSessionToken, newConvexClient } from "./testSetup";

test("a prepared poll can be edited and then goes live with the new content", async ({ page }) => {
  const client = newConvexClient();
  await getModeratorSessionToken(client);
  const { eventId } = await createTestEvent(client, `Edit ${Date.now()}`);

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("e2e-mod@example.com");
  await page.getByLabel("Password").fill("e2e-test-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/admin\/events/);
  await page.goto(`/admin/events/${eventId}/polls`);

  await page.getByLabel("Question").fill("Draft?");
  await page.getByLabel("Option 1").fill("Yes");
  await page.getByLabel("Option 2").fill("No");
  await page.getByRole("button", { name: "Save for later" }).click();
  await expect(page.getByRole("heading", { name: "Prepared polls" })).toBeVisible();
  await expect(page.getByText("Draft?")).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("Question")).toHaveValue("Draft?");
  await page.getByLabel("Question").fill("Edited?");
  await page.getByLabel("Option 2").fill("Maybe");
  // Enter must save the edit, not start a new poll.
  await page.getByLabel("Question").press("Enter");

  await expect(page.getByText("Edited?")).toBeVisible();
  await expect(page.getByText("Draft?")).toHaveCount(0);
  await expect(page.getByText("Maybe")).toBeVisible();
  await expect(page.getByLabel("Question")).toHaveValue("");
  await expect(page.getByRole("region", { name: "Poll", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Go live" }).click();
  await expect(page.getByRole("region", { name: "Poll", exact: true })).toContainText("Edited?");
});
