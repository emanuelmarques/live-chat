import { test, expect } from "@playwright/test";
import { createTestEvent, getModeratorSessionToken, newConvexClient } from "./testSetup";

test("a moderator can remove a participant and restore them, and their chat resumes by itself", async ({
  browser,
}) => {
  const client = newConvexClient();
  await getModeratorSessionToken(client);
  const { eventId, joinSlug } = await createTestEvent(client, `Kick ${Date.now()}`);

  const modContext = await browser.newContext();
  const personContext = await browser.newContext();
  const mod = await modContext.newPage();
  const person = await personContext.newPage();
  mod.on("dialog", (d) => d.accept());

  await mod.goto("/admin/login");
  await mod.getByLabel("Email").fill("e2e-mod@example.com");
  await mod.getByLabel("Password").fill("e2e-test-password");
  await mod.getByRole("button", { name: "Log in" }).click();
  await expect(mod).toHaveURL(/\/admin\/events/);

  await person.goto(`/join/${joinSlug}`);
  await person.getByLabel("Your name").fill("Restorable");
  await person.getByRole("button", { name: "Join chat" }).click();
  await expect(person.getByLabel("Message")).toBeVisible();

  await mod.goto(`/admin/events/${eventId}/participants`);
  await mod.getByRole("button", { name: "Kick" }).click();
  await expect(person.getByText("You've been removed")).toBeVisible();

  await mod.getByRole("button", { name: "Restore" }).click();
  await expect(person.getByText("You've been removed")).toHaveCount(0);
  await person.getByLabel("Message").fill("I'm back");
  await person.getByRole("button", { name: "Send", exact: true }).click();
  await expect(person.getByText("I'm back")).toBeVisible();
  await expect(mod.getByRole("button", { name: "Kick" })).toBeVisible();

  await modContext.close();
  await personContext.close();
});
