import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { createModeratorSession, listVisibleMessages, newTestInstance } from "./testHelpers";

async function setup(t: ReturnType<typeof newTestInstance>) {
  const sessionToken = await createModeratorSession(t);
  const { eventId } = await t.mutation(api.events.createEvent, { sessionToken, name: "Live" });
  const { participantId } = await t.mutation(api.participants.joinEvent, { eventId, displayName: "Ana" });
  const { participantId: otherId } = await t.mutation(api.participants.joinEvent, {
    eventId,
    displayName: "Rui",
  });
  const { messageId } = await t.mutation(api.messages.sendMessage, {
    eventId,
    participantId,
    content: "Olá",
  });
  return { eventId, participantId, otherId, messageId, sessionToken };
}

async function counts(t: ReturnType<typeof newTestInstance>, eventId: Id<"events">, since = 0) {
  return t.query(api.messageReactions.listMessageReactions, { eventId, since });
}

describe("message reactions", () => {
  test("counts are limited to messages sent at or after `since`", async () => {
    const t = newTestInstance();
    const { eventId, participantId, messageId } = await setup(t);
    const second = await t.mutation(api.messages.sendMessage, { eventId, participantId, content: "Mais tarde" });
    await t.mutation(api.messageReactions.toggleMessageReaction, { messageId, participantId, emoji: "👍" });
    await t.mutation(api.messageReactions.toggleMessageReaction, { messageId: second.messageId, participantId, emoji: "🎉" });

    const [first, later] = await listVisibleMessages(t, eventId);
    expect(Object.keys(await counts(t, eventId, first.sentAt)).sort()).toEqual([messageId, second.messageId].sort());
    // A window that starts after the first message only returns the later one's reactions.
    const onlyLater = await counts(t, eventId, later.sentAt + 1);
    expect(onlyLater).toEqual({});
    expect(await counts(t, eventId, later.sentAt)).toEqual(
      later.sentAt === first.sentAt
        ? { [messageId]: [{ emoji: "👍", count: 1 }], [second.messageId]: [{ emoji: "🎉", count: 1 }] }
        : { [second.messageId]: [{ emoji: "🎉", count: 1 }] },
    );
  });

  test("listMyMessageReactions returns only the participant's own reactions", async () => {
    const t = newTestInstance();
    const { eventId, participantId, otherId, messageId } = await setup(t);
    await t.mutation(api.messageReactions.toggleMessageReaction, { messageId, participantId, emoji: "👍" });
    await t.mutation(api.messageReactions.toggleMessageReaction, { messageId, participantId: otherId, emoji: "🎉" });

    expect(await t.query(api.messageReactions.listMyMessageReactions, { eventId, participantId })).toEqual([
      { messageId, emoji: "👍" },
    ]);
    expect(await t.query(api.messageReactions.listMyMessageReactions, { eventId, participantId: otherId })).toEqual([
      { messageId, emoji: "🎉" },
    ]);
  });

  test("backfillMessageSentAt makes old reactions (without messageSentAt) countable", async () => {
    const t = newTestInstance();
    const { eventId, participantId, messageId } = await setup(t);
    await t.mutation(api.messageReactions.toggleMessageReaction, { messageId, participantId, emoji: "👍" });
    await t.run(async (ctx) => {
      const [row] = await ctx.db.query("messageReactions").collect();
      await ctx.db.patch(row._id, { messageSentAt: undefined });
    });
    expect(await counts(t, eventId)).toEqual({});
    expect(await t.mutation(internal.messageReactions.backfillMessageSentAt, {})).toEqual({ updated: 1 });
    expect(await counts(t, eventId)).toEqual({ [messageId]: [{ emoji: "👍", count: 1 }] });
  });

  test("toggling adds then removes a reaction", async () => {
    const t = newTestInstance();
    const { eventId, participantId, messageId } = await setup(t);

    const first = await t.mutation(api.messageReactions.toggleMessageReaction, {
      messageId,
      participantId,
      emoji: "👎",
    });
    expect(first.active).toBe(true);
    expect(await counts(t, eventId)).toEqual({ [messageId]: [{ emoji: "👎", count: 1 }] });

    const second = await t.mutation(api.messageReactions.toggleMessageReaction, {
      messageId,
      participantId,
      emoji: "👎",
    });
    expect(second.active).toBe(false);
    expect(await counts(t, eventId)).toEqual({});
  });

  test("aggregates reactions from several participants", async () => {
    const t = newTestInstance();
    const { eventId, participantId, otherId, messageId } = await setup(t);
    await t.mutation(api.messageReactions.toggleMessageReaction, { messageId, participantId, emoji: "👍" });
    await t.mutation(api.messageReactions.toggleMessageReaction, { messageId, participantId: otherId, emoji: "👍" });

    expect(await counts(t, eventId)).toEqual({ [messageId]: [{ emoji: "👍", count: 2 }] });
  });

  test("rejects an emoji outside the curated set", async () => {
    const t = newTestInstance();
    const { participantId, messageId } = await setup(t);
    await expect(
      t.mutation(api.messageReactions.toggleMessageReaction, { messageId, participantId, emoji: "🦄" }),
    ).rejects.toThrow("Unsupported reaction emoji.");
  });

  test("a kicked participant cannot react", async () => {
    const t = newTestInstance();
    const { participantId, otherId, messageId, sessionToken } = await setup(t);
    await t.mutation(api.participants.kickParticipant, { sessionToken, participantId: otherId });
    await expect(
      t.mutation(api.messageReactions.toggleMessageReaction, { messageId, participantId: otherId, emoji: "👍" }),
    ).rejects.toThrow(/Kicked/);
    expect(participantId).toBeDefined();
  });

  test("👎 is accepted as a flying reaction too", async () => {
    const t = newTestInstance();
    const { eventId, participantId } = await setup(t);
    await t.mutation(api.reactions.sendReaction, { eventId, participantId, emoji: "👎" });
    const recent = await t.query(api.reactions.listRecentReactions, { eventId });
    expect(recent[0].emoji).toBe("👎");
  });
});
