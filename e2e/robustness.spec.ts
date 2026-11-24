import { test, expect, devices } from "@playwright/test";
import { api } from "../convex/_generated/api";
import { newConvexClient, getModeratorSessionToken, createTestEvent } from "./testSetup";

test.use({ ...devices["Pixel 7"], viewport: { width: 360, height: 740 } });

test.describe("Corner cases on a phone", () => {
  test("a stale participant on an unknown event code sees not-found, not an endless spinner", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() =>
      localStorage.setItem(
        "liveChat.participant.ZZZZZZ",
        JSON.stringify({ participantId: "stale", displayName: "Old" }),
      ),
    );
    await page.goto("/chat/ZZZZZZ");
    await expect(page.getByText("We couldn't find this event")).toBeVisible();
    await expect(page.getByText("Loading…")).toHaveCount(0);

    await page.goto("/projector/ZZZZZZ");
    await expect(page.getByText("We couldn't find this event")).toBeVisible();
    await expect(page.getByText("Loading…")).toHaveCount(0);
  });

  test("voting in a hidden-results poll gives immediate feedback, and a repeat vote doesn't crash", async ({ page }) => {
    const client = newConvexClient();
    const token = await getModeratorSessionToken(client);
    const { eventId, joinSlug } = await createTestEvent(client, "Vote feedback");

    await page.goto(`/join/${joinSlug}`);
    await page.getByLabel("Your name").fill("Voter");
    await page.getByRole("button", { name: "Join chat" }).click();
    await page.waitForURL(/\/chat\//);

    await client.mutation(api.polls.createAndStartPoll, {
      sessionToken: token,
      eventId,
      question: "Pick one",
      options: ["Alpha", "Beta"],
      revealMode: "atEnd",
    });

    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await page.getByRole("button", { name: "Beta" }).click();
    await expect(page.getByText("You voted.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Beta" })).toBeDisabled();

    // Same participant on a "second device": local flag missing, server already has the vote.
    await page.evaluate(() => localStorage.removeItem("liveChat.votedPollIds"));
    await page.reload();
    await page.getByRole("button", { name: "Alpha" }).click();
    await expect(page.getByText("You voted.")).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("long unbroken text and a long name don't cause horizontal scrolling", async ({ page }) => {
    const client = newConvexClient();
    const { joinSlug } = await createTestEvent(client, "Overflow");

    await page.goto(`/join/${joinSlug}`);
    await page.getByLabel("Your name").fill("N".repeat(40));
    await page.getByRole("button", { name: "Join chat" }).click();
    await page.waitForURL(/\/chat\//);

    const composer = page.getByLabel("Type a message");
    await composer.fill("A".repeat(300));
    await composer.press("Enter");
    // Held for approval (matches the "https://" default term) — the pending bubble must wrap too.
    await composer.fill("https://example.com/" + "path/".repeat(30));
    await composer.press("Enter");
    await expect(page.getByText("Awaiting approval")).toBeVisible();

    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll(".bubble, .pending")].filter(
        (el) => el.scrollWidth > el.clientWidth + 1,
      ).length,
    );
    expect(clipped).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
});
