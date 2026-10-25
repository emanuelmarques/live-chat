import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { createModeratorSession, newTestInstance } from "./testHelpers";

describe("participants", () => {
  test("joinEvent requires a non-empty display name", async () => {
    const t = newTestInstance();
    const sessionToken = await createModeratorSession(t);
    const { eventId } = await t.mutation(api.events.createEvent, {
      sessionToken,
      name: "Podcast Live",
    });

    await expect(
      t.mutation(api.participants.joinEvent, { eventId, displayName: "   " }),
    ).rejects.toThrow();

    const { participantId } = await t.mutation(api.participants.joinEvent, {
      eventId,
      displayName: "Ana",
    });
    expect(participantId).toBeDefined();
  });

  test("display names are not required to be unique", async () => {
    const t = newTestInstance();
    const sessionToken = await createModeratorSession(t);
    const { eventId } = await t.mutation(api.events.createEvent, {
      sessionToken,
      name: "Podcast Live",
    });

    const first = await t.mutation(api.participants.joinEvent, { eventId, displayName: "Ana" });
    const second = await t.mutation(api.participants.joinEvent, { eventId, displayName: "Ana" });
    expect(first.participantId).not.toBe(second.participantId);
  });

  test("countParticipants only counts the given event", async () => {
    const t = newTestInstance();
    const sessionToken = await createModeratorSession(t);
    const a = await t.mutation(api.events.createEvent, { sessionToken, name: "A" });
    const b = await t.mutation(api.events.createEvent, { sessionToken, name: "B" });
    await t.mutation(api.participants.joinEvent, { eventId: a.eventId, displayName: "Ana" });
    await t.mutation(api.participants.joinEvent, { eventId: a.eventId, displayName: "Rui" });
    await t.mutation(api.participants.joinEvent, { eventId: b.eventId, displayName: "Eva" });

    expect(await t.query(api.participants.countParticipants, { eventId: a.eventId })).toBe(2);
    expect(await t.query(api.participants.countParticipants, { eventId: b.eventId })).toBe(1);
  });

  test("listParticipants requires a moderator session and is scoped to the event", async () => {
    const t = newTestInstance();
    const sessionToken = await createModeratorSession(t);
    const a = await t.mutation(api.events.createEvent, { sessionToken, name: "A" });
    const b = await t.mutation(api.events.createEvent, { sessionToken, name: "B" });
    await t.mutation(api.participants.joinEvent, { eventId: a.eventId, displayName: "Ana" });
    await t.mutation(api.participants.joinEvent, { eventId: b.eventId, displayName: "Eva" });

    await expect(
      t.query(api.participants.listParticipants, { sessionToken: "bad-token", eventId: a.eventId }),
    ).rejects.toThrow();

    const list = await t.query(api.participants.listParticipants, {
      sessionToken,
      eventId: a.eventId,
    });
    expect(list.map((p) => p.displayName)).toEqual(["Ana"]);
  });

  test("joining an ended event is rejected", async () => {
    const t = newTestInstance();
    const sessionToken = await createModeratorSession(t);
    const { eventId } = await t.mutation(api.events.createEvent, {
      sessionToken,
      name: "Podcast Live",
    });
    await t.mutation(api.events.endEvent, { sessionToken, eventId });

    await expect(
      t.mutation(api.participants.joinEvent, { eventId, displayName: "Ana" }),
    ).rejects.toThrow();
  });
});
