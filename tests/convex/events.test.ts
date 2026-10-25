import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { createModeratorSession, newTestInstance } from "./testHelpers";

describe("events", () => {
  test("createEvent requires moderator auth and returns a join slug", async () => {
    const t = newTestInstance();
    await expect(
      t.mutation(api.events.createEvent, { sessionToken: "bogus", name: "Podcast Live" }),
    ).rejects.toThrow();

    const sessionToken = await createModeratorSession(t);
    const { eventId, joinSlug } = await t.mutation(api.events.createEvent, {
      sessionToken,
      name: "Podcast Live",
    });
    expect(eventId).toBeDefined();
    expect(joinSlug.length).toBeGreaterThan(0);
  });

  test("getJoinInfo resolves a slug to event status, and is not moderator-gated", async () => {
    const t = newTestInstance();
    const sessionToken = await createModeratorSession(t);
    const { eventId, joinSlug } = await t.mutation(api.events.createEvent, {
      sessionToken,
      name: "Podcast Live",
    });

    const info = await t.query(api.events.getJoinInfo, { joinSlug });
    expect(info).toEqual({ eventId, name: "Podcast Live", status: "active" });

    const missing = await t.query(api.events.getJoinInfo, { joinSlug: "does-not-exist" });
    expect(missing).toBeNull();
  });

  test("endEvent flips status, after which getJoinInfo reports 'ended'", async () => {
    const t = newTestInstance();
    const sessionToken = await createModeratorSession(t);
    const { eventId, joinSlug } = await t.mutation(api.events.createEvent, {
      sessionToken,
      name: "Podcast Live",
    });

    await t.mutation(api.events.endEvent, { sessionToken, eventId });

    const info = await t.query(api.events.getJoinInfo, { joinSlug });
    expect(info?.status).toBe("ended");

    const event = await t.query(api.events.getEvent, { eventId });
    expect(event?.status).toBe("ended");
    expect(event?.endedAt).not.toBeNull();
  });

  test("listEvents is moderator-only and lists created events", async () => {
    const t = newTestInstance();
    await expect(t.query(api.events.listEvents, { sessionToken: "bogus" })).rejects.toThrow();

    const sessionToken = await createModeratorSession(t);
    await t.mutation(api.events.createEvent, { sessionToken, name: "Event A" });
    await t.mutation(api.events.createEvent, { sessionToken, name: "Event B" });

    const events = await t.query(api.events.listEvents, { sessionToken });
    expect(events.map((e) => e.name).sort()).toEqual(["Event A", "Event B"]);
  });
});
