import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { api } from "../convex/_generated/api";
import { newConvexClient, createTestEvent } from "./testSetup";

test.describe("Zoom-style flying reactions", () => {
  test("a reaction sent by one participant flies for another participant and on the projector", async ({
    browser,
  }) => {
    const client = newConvexClient();
    const { joinSlug } = await createTestEvent(client, `Reactions ${Date.now()}`);

    const senderContext = await browser.newContext();
    const watcherContext = await browser.newContext();
    const projectorContext = await browser.newContext();
    const sender = await senderContext.newPage();
    const watcher = await watcherContext.newPage();
    const projector = await projectorContext.newPage();

    await sender.goto(`/join/${joinSlug}`);
    await sender.getByLabel("Your name").fill("Sender");
    await sender.getByRole("button", { name: "Join chat" }).click();
    await expect(sender).toHaveURL(new RegExp(`/chat/${joinSlug}`));

    await watcher.goto(`/join/${joinSlug}`);
    await watcher.getByLabel("Your name").fill("Watcher");
    await watcher.getByRole("button", { name: "Join chat" }).click();

    await projector.goto(`/projector/${joinSlug}`);

    await sender.getByRole("button", { name: "React" }).click();
    await sender.getByRole("menuitem", { name: "🎉" }).click();

    await expect(watcher.locator(".reaction-fly").filter({ hasText: "🎉" })).toBeVisible({
      timeout: 5000,
    });
    await expect(projector.locator(".reaction-fly").filter({ hasText: "🎉" })).toBeVisible({
      timeout: 5000,
    });

    await senderContext.close();
    await watcherContext.close();
    await projectorContext.close();
  });
});

test.describe("Emoji picker and Slack-style shortcodes", () => {
  test("search in the full picker inserts an emoji at the cursor", async ({ page }) => {
    const client = newConvexClient();
    const { joinSlug } = await createTestEvent(client, `Emoji picker ${Date.now()}`);

    await page.goto(`/join/${joinSlug}`);
    await page.getByLabel("Your name").fill("Picker Person");
    await page.getByRole("button", { name: "Join chat" }).click();

    await page.getByLabel("Type a message").fill("so ");
    await page.getByRole("button", { name: "Add an emoji" }).click();
    await page.getByLabel("Search emoji").fill("fire");
    await page.getByRole("button", { name: "fire" }).first().click();

    await expect(page.getByLabel("Type a message")).toHaveValue("so 🔥");
  });

  test("typing a Slack-style :shortcode: replaces it with the matching emoji", async ({ page }) => {
    const client = newConvexClient();
    const { joinSlug } = await createTestEvent(client, `Shortcode ${Date.now()}`);

    await page.goto(`/join/${joinSlug}`);
    await page.getByLabel("Your name").fill("Shortcode Person");
    await page.getByRole("button", { name: "Join chat" }).click();

    const composer = page.getByLabel("Type a message");
    await composer.fill("so hyped :fire:");

    await expect(composer).toHaveValue("so hyped 🔥");
  });

  test("the reaction popover and the emoji picker are each free of automated accessibility violations when open", async ({
    page,
  }) => {
    const client = newConvexClient();
    const { joinSlug } = await createTestEvent(client, `A11y popovers ${Date.now()}`);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/join/${joinSlug}`);
    await page.getByLabel("Your name").fill("A11y Person");
    await page.getByRole("button", { name: "Join chat" }).click();

    await page.getByRole("button", { name: "React" }).click();
    await expect(page.getByRole("menu", { name: "Reactions" })).toBeVisible();
    const reactionScan = await new AxeBuilder({ page }).analyze();
    expect(reactionScan.violations).toEqual([]);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Add an emoji" }).click();
    await expect(page.getByRole("dialog", { name: "Emoji picker" })).toBeVisible();
    const pickerScan = await new AxeBuilder({ page }).analyze();
    expect(pickerScan.violations).toEqual([]);
  });
});

test.describe("Opening the chat jumps to the latest messages", () => {
  test("a participant joining a conversation with history lands scrolled to the bottom", async ({
    page,
  }) => {
    const client = newConvexClient();
    const { eventId, joinSlug } = await createTestEvent(client, `Scroll ${Date.now()}`);
    // Spread sends across several participants — sendMessage rate-limits each
    // participant to 5 messages per 10s window, and this is seeding history,
    // not testing that limit.
    for (let i = 1; i <= 30; i++) {
      const { participantId } = await client.mutation(api.participants.joinEvent, {
        eventId,
        displayName: `History Writer ${i}`,
      });
      await client.mutation(api.messages.sendMessage, {
        eventId,
        participantId,
        content: `Message ${i}`,
      });
    }

    await page.goto(`/join/${joinSlug}`);
    await page.getByLabel("Your name").fill("Late Joiner");
    await page.getByRole("button", { name: "Join chat" }).click();
    await expect(page).toHaveURL(new RegExp(`/chat/${joinSlug}`));

    await expect(page.getByText("Message 30")).toBeVisible({ timeout: 5000 });

    const { scrollTop, scrollHeight, clientHeight } = await page.locator(".chat__scroll").evaluate(
      (el) => ({ scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }),
    );
    expect(scrollHeight - scrollTop - clientHeight).toBeLessThan(80);
  });
});
