import { test, expect } from "@playwright/test";
import { api } from "../convex/_generated/api";
import { createTestEvent, getModeratorSessionToken, newConvexClient } from "./testSetup";

test.describe("US4: export event chat", () => {
  test("the moderator can download a CSV of the event's visible chat", async ({ page }) => {
    const client = newConvexClient();
    await getModeratorSessionToken(client);
    const { eventId } = await createTestEvent(client, `Export ${Date.now()}`);
    const { participantId } = await client.mutation(api.participants.joinEvent, {
      eventId,
      displayName: "Ana",
    });
    await client.mutation(api.messages.sendMessage, {
      eventId,
      participantId,
      content: "Hello, exported!",
    });

    await page.goto("/admin/login");
    await page.getByLabel("Email").fill("e2e-mod@example.com");
    await page.getByLabel("Password").fill("e2e-test-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/admin\/events/);

    await page.goto(`/admin/events/${eventId}/export`);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download CSV" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(`chat-export-${eventId}.csv`);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(chunk as Buffer);
    const content = Buffer.concat(chunks).toString("utf-8");

    expect(content).toContain("Hello, exported!");
    expect(content).toContain("sender,content,sentAt");
  });
});
