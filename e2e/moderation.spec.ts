import { test, expect } from "@playwright/test";
import { api } from "../convex/_generated/api";
import { newConvexClient, createTestEvent, getModeratorSessionToken } from "./testSetup";

test.describe("US2: moderated, safe chat", () => {
  test("a message matching a block-list term is held until the moderator approves or rejects it", async ({
    browser,
  }) => {
    const client = newConvexClient();
    const sessionToken = await getModeratorSessionToken(client);
    const { eventId, joinSlug } = await createTestEvent(client, `Moderation ${Date.now()}`);
    const term = `bannedword${Date.now()}`;
    await client.mutation(api.moderation.addBlockListEntry, { sessionToken, term });

    const senderContext = await browser.newContext();
    const otherContext = await browser.newContext();
    const sender = await senderContext.newPage();
    const other = await otherContext.newPage();

    await sender.goto(`/join/${joinSlug}`);
    await sender.getByLabel("Your name").fill("Sender");
    await sender.getByRole("button", { name: "Join chat" }).click();

    await other.goto(`/join/${joinSlug}`);
    await other.getByLabel("Your name").fill("Other");
    await other.getByRole("button", { name: "Join chat" }).click();

    await sender.getByLabel("Type a message").fill(`this has ${term} in it`);
    await sender.getByRole("button", { name: "Send" }).click();

    // Sender sees their own message held; the other participant never sees it at all.
    await expect(sender.getByText(/awaiting approval/i)).toBeVisible({ timeout: 5000 });
    await expect(other.getByText(new RegExp(term))).toHaveCount(0);

    await sender.goto(`/admin/login`);
    await sender.getByLabel("Email").fill("e2e-mod@example.com");
    await sender.getByLabel("Password").fill("e2e-test-password");
    await sender.getByRole("button", { name: "Log in" }).click();
    await expect(sender).toHaveURL(/\/admin\/events/);

    await sender.goto(`/admin/events/${eventId}/moderation`);
    await expect(sender.getByText(new RegExp(term)).first()).toBeVisible();
    await sender.getByRole("button", { name: "Approve" }).click();

    await expect(other.getByText(new RegExp(term))).toBeVisible({ timeout: 5000 });

    await senderContext.close();
    await otherContext.close();
  });
});
