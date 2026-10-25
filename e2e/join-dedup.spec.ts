import { test, expect } from "@playwright/test";
import { createTestEvent, newConvexClient } from "./testSetup";

test.describe("Safeguard: one participant per browser per event", () => {
  test("two tabs racing to join the same event end up sharing one participant identity", async ({
    browser,
  }) => {
    const client = newConvexClient();
    const { joinSlug } = await createTestEvent(client, `Dedup ${Date.now()}`);

    // Same browser context => same localStorage, like two tabs in one browser.
    const context = await browser.newContext();
    const tabA = await context.newPage();
    const tabB = await context.newPage();

    await Promise.all([tabA.goto(`/join/${joinSlug}`), tabB.goto(`/join/${joinSlug}`)]);

    await tabA.getByLabel("Your name").fill("Tab A Person");
    await tabB.getByLabel("Your name").fill("Tab B Person");

    // Submit as close together as possible to exercise the race the Web
    // Locks guard (joinOncePerBrowser) is meant to close. In a true race, the
    // losing tab's join form can be redirected away (by the `storage` event
    // listener) mid-click, which Playwright reports as the button detaching —
    // that's the dedup working as intended, not a test failure, so it's
    // tolerated here; the real assertions are the end-state checks below.
    await Promise.all([
      tabA.getByRole("button", { name: "Join chat" }).click().catch(() => {}),
      tabB.getByRole("button", { name: "Join chat" }).click().catch(() => {}),
    ]);

    await expect(tabA).toHaveURL(new RegExp(`/chat/${joinSlug}`));
    await expect(tabB).toHaveURL(new RegExp(`/chat/${joinSlug}`));

    const stored = (page: typeof tabA) =>
      page.evaluate((slug) => localStorage.getItem(`liveChat.participant.${slug}`), joinSlug);

    const storedA = await stored(tabA);
    const storedB = await stored(tabB);
    expect(storedA).not.toBeNull();
    expect(storedA).toBe(storedB); // same participantId + displayName JSON in both tabs

    await context.close();
  });

  test("a tab sitting on the join form redirects once another tab (same browser) finishes joining", async ({
    browser,
  }) => {
    const client = newConvexClient();
    const { joinSlug } = await createTestEvent(client, `Dedup sequential ${Date.now()}`);

    const context = await browser.newContext();
    const tabA = await context.newPage();
    const tabB = await context.newPage();

    await tabA.goto(`/join/${joinSlug}`);
    await tabB.goto(`/join/${joinSlug}`);

    await tabA.getByLabel("Your name").fill("First Tab");
    await tabA.getByRole("button", { name: "Join chat" }).click();
    await expect(tabA).toHaveURL(new RegExp(`/chat/${joinSlug}`));

    // tabB was left sitting on the join form the whole time; it should pick
    // up tabA's join via the storage event and redirect on its own.
    await expect(tabB).toHaveURL(new RegExp(`/chat/${joinSlug}`), { timeout: 5000 });

    await context.close();
  });
});
