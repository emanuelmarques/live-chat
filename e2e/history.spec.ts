import { test, expect, type Page } from "@playwright/test";
import type { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { newConvexClient, createTestEvent } from "./testSetup";

const TOTAL = 130; // > 2 pages of 50

/** Seeds `count` messages (history-0 … history-N-1) from several senders, to stay under the per-sender rate limit. */
async function seedMessages(client: ConvexHttpClient, eventId: Id<"events">, count: number, prefix = "history") {
  const senders: Id<"participants">[] = [];
  for (let i = 0; i < Math.ceil(count / 5); i++) {
    senders.push((await client.mutation(api.participants.joinEvent, { eventId, displayName: `Seed ${i}` })).participantId);
  }
  const messageIds: Id<"messages">[] = [];
  for (let i = 0; i < count; i++) {
    const r = await client.mutation(api.messages.sendMessage, {
      eventId,
      participantId: senders[Math.floor(i / 5)],
      content: `${prefix}-${i}`,
    });
    messageIds.push(r.messageId);
  }
  return { senders, messageIds };
}

async function joinAs(page: Page, joinSlug: string, name: string) {
  await page.goto(`/join/${joinSlug}`);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Join chat" }).click();
  await expect(page).toHaveURL(new RegExp(`/chat/${joinSlug}`));
}

test.describe("chat history is loaded in pages", () => {
  test("opens at the newest message and loads older ones on scroll, keeping the reader's place", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const client = newConvexClient();
    const { joinSlug, eventId } = await createTestEvent(client, `History ${Date.now()}`);
    await seedMessages(client, eventId, TOTAL);

    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await joinAs(page, joinSlug, "Reader");

    const scroller = page.locator(".chat__scroll");
    await expect(page.getByText(`history-${TOTAL - 1}`, { exact: true })).toBeVisible();
    // Only the newest page is loaded at first, and the view is at the bottom.
    await expect(page.getByText("history-0", { exact: true })).toHaveCount(0);
    await expect(page.getByText(`history-${TOTAL - 51}`, { exact: true })).toHaveCount(0);
    await expect(page.getByText(`history-${TOTAL - 50}`, { exact: true })).toHaveCount(1);
    expect(
      await scroller.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
    ).toBeLessThan(80);

    // Scroll to the top: the next page loads and the message that was on top stays where it was.
    const firstLoaded = page.getByText(`history-${TOTAL - 50}`, { exact: true });
    const offsetBefore = await scroller.evaluate((el) => {
      el.scrollTop = 0;
      const target = [...el.querySelectorAll(".bubble span")].find((s) => s.textContent === "history-80")!;
      return target.getBoundingClientRect().top - el.getBoundingClientRect().top;
    });
    await expect(page.getByText(`history-${TOTAL - 51}`, { exact: true })).toHaveCount(1);
    const offsetAfter = await scroller.evaluate((el) => {
      const target = [...el.querySelectorAll(".bubble span")].find((s) => s.textContent === "history-80")!;
      return target.getBoundingClientRect().top - el.getBoundingClientRect().top;
    });
    expect(Math.abs(offsetAfter - offsetBefore)).toBeLessThan(8);
    await expect(firstLoaded).toHaveCount(1);

    // Keep scrolling up until the whole history is there.
    await expect
      .poll(
        async () => {
          await scroller.evaluate((el) => (el.scrollTop = 0));
          return page.getByText("history-0", { exact: true }).count();
        },
        { timeout: 20_000 },
      )
      .toBe(1);
    await expect(page.getByRole("button", { name: "Load earlier messages" })).toHaveCount(0);

    await context.close();
  });

  test("a message that arrives while the reader is up in the history doesn't pull them down", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const client = newConvexClient();
    const { joinSlug, eventId } = await createTestEvent(client, `History hold ${Date.now()}`);
    await seedMessages(client, eventId, 60);
    // Fresh senders: the seeding ones are at their per-sender rate limit.
    const fresh = async (name: string) =>
      (await client.mutation(api.participants.joinEvent, { eventId, displayName: name })).participantId;
    const [first, second] = [await fresh("Late A"), await fresh("Late B")];

    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await joinAs(page, joinSlug, "Reader");
    const scroller = page.locator(".chat__scroll");
    await expect(page.getByText("history-59", { exact: true })).toBeVisible();

    // Where a message in view sits inside the scroller (the oldest ones slide out of the page as new ones arrive).
    const offsetOf = (text: string) =>
      scroller.evaluate((el, t) => {
        const target = [...el.querySelectorAll(".bubble span")].find((s) => s.textContent === t)!;
        return target.getBoundingClientRect().top - el.getBoundingClientRect().top;
      }, text);
    await page.getByText("history-35", { exact: true }).scrollIntoViewIfNeeded();
    await scroller.evaluate((el) => (el.scrollTop -= 200));
    const before = await offsetOf("history-35");
    await client.mutation(api.messages.sendMessage, {
      eventId,
      participantId: first,
      content: "arrived-while-reading",
    });
    await expect(page.getByText("arrived-while-reading", { exact: true })).toHaveCount(1);
    expect(Math.abs((await offsetOf("history-35")) - before)).toBeLessThan(8);

    // Back at the bottom, the next one is followed.
    await scroller.evaluate((el) => (el.scrollTop = el.scrollHeight));
    await client.mutation(api.messages.sendMessage, {
      eventId,
      participantId: second,
      content: "arrived-at-bottom",
    });
    await expect(page.getByText("arrived-at-bottom", { exact: true })).toBeInViewport();
    await context.close();
  });
});

test.describe("a long live conversation", () => {
  test("stays complete, ordered and without duplicates while the newest page splits", async ({ browser }) => {
    test.setTimeout(120_000);
    const client = newConvexClient();
    const { joinSlug, eventId } = await createTestEvent(client, `Live split ${Date.now()}`);
    await seedMessages(client, eventId, 20);

    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await joinAs(page, joinSlug, "Reader");
    await expect(page.getByText("history-19", { exact: true })).toBeVisible();

    // 130 more arrive while the page is open: the newest page grows past twice its size and is split.
    const { messageIds } = await seedMessages(client, eventId, 130, "live");
    expect(messageIds).toHaveLength(130);
    await expect(page.getByText("live-129", { exact: true })).toBeVisible({ timeout: 15_000 });

    const texts = await page.locator("li.msg .bubble span").allTextContents();
    expect(texts).toHaveLength(150);
    expect(new Set(texts).size).toBe(150);
    // Oldest first: the 20 original messages, then the 130 new ones.
    expect(texts.slice(0, 20)).toEqual(Array.from({ length: 20 }, (_, i) => `history-${i}`));
    expect(texts.slice(20)).toEqual(Array.from({ length: 130 }, (_, i) => `live-${i}`));
    expect(
      await page.locator(".chat__scroll").evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
    ).toBeLessThan(80);
    await context.close();
  });
});

test.describe("message reaction counts", () => {
  test("show counts, highlight the reader's own, follow other people's changes and cover loaded history", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const client = newConvexClient();
    const { joinSlug, eventId } = await createTestEvent(client, `Reaction counts ${Date.now()}`);
    const { senders, messageIds } = await seedMessages(client, eventId, 70);
    const toggle = (i: number, messageId: Id<"messages">, emoji: string) =>
      client.mutation(api.messageReactions.toggleMessageReaction, {
        messageId,
        participantId: senders[i],
        emoji,
      });
    const newest = messageIds[69];
    await toggle(0, newest, "👍");
    await toggle(1, newest, "👍");
    await toggle(0, messageIds[0], "🎉"); // on an older page

    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await joinAs(page, joinSlug, "Reader");
    const row = page.locator("li.msg", { has: page.getByText("history-69", { exact: true }) });

    await expect(row.getByRole("button", { name: "👍 2", exact: true })).toBeVisible();

    // The reader joins in: count goes up and the chip is marked as theirs.
    await row.getByRole("button", { name: "👍 2", exact: true }).click();
    await expect(row.getByRole("button", { name: "👍 3 (you reacted)", exact: true })).toBeVisible();

    // Someone else removes theirs: the count follows, the reader's mark stays.
    await toggle(0, newest, "👍");
    await expect(row.getByRole("button", { name: "👍 2 (you reacted)", exact: true })).toBeVisible();

    // A reaction on a message that is only loaded when scrolling up shows up too.
    const scroller = page.locator(".chat__scroll");
    await expect
      .poll(
        async () => {
          await scroller.evaluate((el) => (el.scrollTop = 0));
          return page.getByText("history-0", { exact: true }).count();
        },
        { timeout: 20_000 },
      )
      .toBe(1);
    const oldRow = page.locator("li.msg", { has: page.getByText("history-0", { exact: true }) });
    await expect(oldRow.getByRole("button", { name: "🎉 1", exact: true })).toBeVisible();
    // ...and the newest one kept its counts after the window widened.
    await expect(row.getByRole("button", { name: "👍 2 (you reacted)", exact: true })).toBeVisible();

    // The projector shows the same counts (read-only) and only the newest page.
    const projector = await (await browser.newContext()).newPage();
    await projector.goto(`/projector/${joinSlug}`);
    await expect(projector.getByText("history-69", { exact: true })).toBeVisible();
    await expect(projector.locator('[aria-label="👍 2"]')).toBeVisible();
    await expect(projector.getByText("history-0", { exact: true })).toHaveCount(0);
    await expect(projector.getByRole("button", { name: "Load earlier messages" })).toHaveCount(0);
    await context.close();
  });
});
