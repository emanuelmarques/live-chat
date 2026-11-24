import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { createModeratorSession, newTestInstance } from "./testHelpers";

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

describe("message reactions", () => {
  test("toggling adds then removes a reaction", async () => {
    const t = newTestInstance();
    const { eventId, participantId, messageId } = await setup(t);

    const first = await t.mutation(api.messageReactions.toggleMessageReaction, {
      messageId,
      participantId,
      emoji: "👎",
    });
    expect(first.active).toBe(true);
    let [msg] = await t.query(api.messages.listMessages, { eventId });
    expect(msg.reactions).toEqual([{ emoji: "👎", participantIds: [participantId] }]);

    const second = await t.mutation(api.messageReactions.toggleMessageReaction, {
      messageId,
      participantId,
      emoji: "👎",
    });
    expect(second.active).toBe(false);
    [msg] = await t.query(api.messages.listMessages, { eventId });
    expect(msg.reactions).toEqual([]);
  });

  test("aggregates reactions from several participants", async () => {
    const t = newTestInstance();
    const { eventId, participantId, otherId, messageId } = await setup(t);
    await t.mutation(api.messageReactions.toggleMessageReaction, { messageId, participantId, emoji: "👍" });
    await t.mutation(api.messageReactions.toggleMessageReaction, { messageId, participantId: otherId, emoji: "👍" });

    const [msg] = await t.query(api.messages.listMessages, { eventId });
    expect(msg.reactions).toHaveLength(1);
    expect(msg.reactions[0].participantIds).toHaveLength(2);
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
