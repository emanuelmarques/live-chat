import { test, expect } from "@playwright/test";
import { createTestEvent, getModeratorSessionToken, newConvexClient } from "./testSetup";

async function loginAsModerator(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("e2e-mod@example.com");
  await page.getByLabel("Password").fill("e2e-test-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/admin\/events/);
}

test.describe("US3: live polls with shared highlighting", () => {
  test("a live-reveal poll highlights on participant and projector views and updates as votes come in", async ({
    browser,
  }) => {
    const client = newConvexClient();
    await getModeratorSessionToken(client);
    const { eventId, joinSlug } = await createTestEvent(client, `Polls ${Date.now()}`);

    const modContext = await browser.newContext();
    const participantContext = await browser.newContext();
    const projectorContext = await browser.newContext();
    const mod = await modContext.newPage();
    const participant = await participantContext.newPage();
    const projector = await projectorContext.newPage();

    await loginAsModerator(mod);
    await mod.goto(`/admin/events/${eventId}/polls`);
    await mod.getByLabel("Question").fill("Favorite color?");
    await mod.getByLabel("Option 1").fill("Red");
    await mod.getByLabel("Option 2").fill("Blue");
    await mod.getByRole("button", { name: "Start poll" }).click();

    await participant.goto(`/join/${joinSlug}`);
    await participant.getByLabel("Your name").fill("Voter");
    await participant.getByRole("button", { name: "Join chat" }).click();

    await projector.goto(`/projector/${joinSlug}`);

    await expect(participant.getByText("Poll in progress")).toBeVisible();
    await expect(projector.getByText("Poll in progress")).toBeVisible();

    await participant.getByRole("button", { name: "Red" }).click();

    await expect(participant.getByText("1 vote(s)")).toBeVisible({ timeout: 5000 });
    await expect(projector.getByText("1 vote(s)")).toBeVisible({ timeout: 5000 });

    // A second vote from the same participant is rejected client-side (button disabled).
    await expect(participant.getByRole("button", { name: "Red" })).toBeDisabled();

    await mod.getByRole("button", { name: "End poll" }).click();
    await expect(participant.getByText("Poll in progress")).toHaveCount(0);
    await expect(projector.getByText("Poll in progress")).toHaveCount(0);

    await modContext.close();
    await participantContext.close();
    await projectorContext.close();
  });

  test("an atEnd poll hides results until the moderator reveals or ends it", async ({ browser }) => {
    const client = newConvexClient();
    await getModeratorSessionToken(client);
    const { eventId, joinSlug } = await createTestEvent(client, `AtEnd polls ${Date.now()}`);

    const modContext = await browser.newContext();
    const participantContext = await browser.newContext();
    const mod = await modContext.newPage();
    const participant = await participantContext.newPage();

    await loginAsModerator(mod);
    await mod.goto(`/admin/events/${eventId}/polls`);
    await mod.getByLabel("Question").fill("Pineapple on pizza?");
    await mod.getByLabel("Option 1").fill("Yes");
    await mod.getByLabel("Option 2").fill("No");
    await mod.getByLabel("Reveal results only at the end").check();
    await mod.getByRole("button", { name: "Start poll" }).click();

    await participant.goto(`/join/${joinSlug}`);
    await participant.getByLabel("Your name").fill("Voter");
    await participant.getByRole("button", { name: "Join chat" }).click();
    await participant.getByRole("button", { name: "Yes" }).click();

    await expect(participant.getByText(/vote\(s\)/)).toHaveCount(0);

    await mod.getByRole("button", { name: "Reveal results now" }).click();
    await expect(participant.getByText("1 vote(s)")).toBeVisible({ timeout: 5000 });

    await modContext.close();
    await participantContext.close();
  });
});
