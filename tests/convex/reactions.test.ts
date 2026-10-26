import { describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { createModeratorSession, newTestInstance } from "./testHelpers";

async function setupEventWithParticipant(t: ReturnType<typeof newTestInstance>) {
  const sessionToken = await createModeratorSession(t);
  const { eventId } = await t.mutation(api.events.createEvent, {
    sessionToken,
    name: "Podcast Live",
  });
  const { participantId } = await t.mutation(api.participants.joinEvent, {
    eventId,
    displayName: "Ana",
  });
  return { eventId, participantId, sessionToken };
}

describe("reactions", () => {
  test("sendReaction is immediately visible to listRecentReactions", async () => {
    const t = newTestInstance();
    const { eventId, participantId } = await setupEventWithParticipant(t);

    await t.mutation(api.reactions.sendReaction, { eventId, participantId, emoji: "🎉" });

    const reactions = await t.query(api.reactions.listRecentReactions, { eventId });
    expect(reactions).toHaveLength(1);
    expect(reactions[0].emoji).toBe("🎉");
  });

  test("rejects an emoji outside the curated reaction set", async () => {
    const t = newTestInstance();
    const { eventId, participantId } = await setupEventWithParticipant(t);

    await expect(
      t.mutation(api.reactions.sendReaction, { eventId, participantId, emoji: "🦄" }),
    ).rejects.toThrow("Unsupported reaction emoji.");
  });

  test("rejects reactions once the event has ended", async () => {
    const t = newTestInstance();
    const sessionToken = await createModeratorSession(t);
    const { eventId } = await t.mutation(api.events.createEvent, { sessionToken, name: "Ends Soon" });
    const { participantId } = await t.mutation(api.participants.joinEvent, {
      eventId,
      displayName: "Ana",
    });
    await t.mutation(api.events.endEvent, { sessionToken, eventId });

    await expect(
      t.mutation(api.reactions.sendReaction, { eventId, participantId, emoji: "👍" }),
    ).rejects.toThrow("This event has ended.");
  });

  test("a kicked participant can no longer send reactions", async () => {
    const t = newTestInstance();
    const { eventId, participantId, sessionToken } = await setupEventWithParticipant(t);
    await t.mutation(api.participants.kickParticipant, { sessionToken, participantId });

    await expect(
      t.mutation(api.reactions.sendReaction, { eventId, participantId, emoji: "👍" }),
    ).rejects.toThrow(/Kicked/);
  });

  test("rate-limits a participant sending reactions too quickly", async () => {
    const t = newTestInstance();
    const { eventId, participantId } = await setupEventWithParticipant(t);

    for (let i = 0; i < 20; i++) {
      await t.mutation(api.reactions.sendReaction, { eventId, participantId, emoji: "👍" });
    }

    await expect(
      t.mutation(api.reactions.sendReaction, { eventId, participantId, emoji: "👍" }),
    ).rejects.toThrow("RateLimited");
  });

  test("pruneOldReactions deletes reactions past retention but keeps recent ones", async () => {
    const t = newTestInstance();
    const { eventId, participantId } = await setupEventWithParticipant(t);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      await t.mutation(api.reactions.sendReaction, { eventId, participantId, emoji: "🔥" });

      vi.setSystemTime(3 * 60_000); // past the 2-minute retention window
      await t.mutation(api.reactions.sendReaction, { eventId, participantId, emoji: "💯" });

      await t.mutation(internal.reactions.pruneOldReactions, {});

      const remaining = await t.query(api.reactions.listRecentReactions, { eventId });
      expect(remaining.map((r) => r.emoji)).toEqual(["💯"]);
    } finally {
      vi.useRealTimers();
    }
  });
});
