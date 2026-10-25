import { test, expect } from "@playwright/test";
import { api } from "../convex/_generated/api";
import { newConvexClient, createTestEvent } from "./testSetup";

test.describe("US1: join and chat across room, remote, and projector", () => {
  test("a message sent by one participant appears for another and on the projector, in order", async ({
    browser,
  }) => {
    const client = newConvexClient();
    const { joinSlug } = await createTestEvent(client, `Chat sync ${Date.now()}`);

    const roomContext = await browser.newContext();
    const remoteContext = await browser.newContext();
    const projectorContext = await browser.newContext();
    const room = await roomContext.newPage();
    const remote = await remoteContext.newPage();
    const projector = await projectorContext.newPage();

    await room.goto(`/join/${joinSlug}`);
    await room.getByLabel("Your name").fill("Room Person");
    await room.getByRole("button", { name: "Join chat" }).click();
    await expect(room).toHaveURL(new RegExp(`/chat/${joinSlug}`));

    await remote.goto(`/join/${joinSlug}`);
    await remote.getByLabel("Your name").fill("Remote Person");
    await remote.getByRole("button", { name: "Join chat" }).click();

    await projector.goto(`/projector/${joinSlug}`);

    await room.getByLabel("Type a message").fill("Hello from the room 👋");
    await room.getByRole("button", { name: "Send" }).click();

    await expect(remote.getByText("Hello from the room 👋")).toBeVisible({ timeout: 5000 });
    await expect(projector.getByText("Hello from the room 👋")).toBeVisible({ timeout: 5000 });

    await remote.getByRole("button", { name: "Reply" }).first().click();
    await remote.getByLabel("Type a message").fill("Hi back!");
    await remote.getByRole("button", { name: "Send" }).click();

    await expect(room.getByText(/Replying to Room Person/)).toBeVisible({ timeout: 5000 });
    await expect(projector.getByText(/Replying to Room Person/)).toBeVisible({ timeout: 5000 });

    await roomContext.close();
    await remoteContext.close();
    await projectorContext.close();
  });

  test("a client that reconnects after going offline catches up on missed messages (FR-033)", async ({
    browser,
  }) => {
    const client = newConvexClient();
    const { joinSlug, eventId } = await createTestEvent(client, `Reconnect ${Date.now()}`);

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`/join/${joinSlug}`);
    await page.getByLabel("Your name").fill("Offline Person");
    await page.getByRole("button", { name: "Join chat" }).click();
    await expect(page).toHaveURL(new RegExp(`/chat/${joinSlug}`));

    await context.setOffline(true);

    const { participantId } = await client.mutation(api.participants.joinEvent, {
      eventId,
      displayName: "Sender",
    });
    await client.mutation(api.messages.sendMessage, {
      eventId,
      participantId,
      content: "You missed this",
    });

    await context.setOffline(false);

    await expect(page.getByText("You missed this")).toBeVisible({ timeout: 10000 });

    await context.close();
  });
});
