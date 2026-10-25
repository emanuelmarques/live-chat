import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
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

describe("messages", () => {
  test("sendMessage is visible immediately in US1 (no moderation gate yet)", async () => {
    const t = newTestInstance();
    const { eventId, participantId } = await setupEventWithParticipant(t);

    await t.mutation(api.messages.sendMessage, {
      eventId,
      participantId,
      content: "Hello 👋",
    });

    const messages = await t.query(api.messages.listMessages, { eventId });
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("Hello 👋");
    expect(messages[0].authorDisplayName).toBe("Ana");
  });

  test("listMessages preserves chronological order", async () => {
    const t = newTestInstance();
    const { eventId, participantId } = await setupEventWithParticipant(t);

    await t.mutation(api.messages.sendMessage, { eventId, participantId, content: "First" });
    await t.mutation(api.messages.sendMessage, { eventId, participantId, content: "Second" });
    await t.mutation(api.messages.sendMessage, { eventId, participantId, content: "Third" });

    const messages = await t.query(api.messages.listMessages, { eventId });
    expect(messages.map((m) => m.content)).toEqual(["First", "Second", "Third"]);
  });

  test("a reply references its original message", async () => {
    const t = newTestInstance();
    const { eventId, participantId } = await setupEventWithParticipant(t);

    const { messageId } = await t.mutation(api.messages.sendMessage, {
      eventId,
      participantId,
      content: "Will slides be shared?",
    });
    await t.mutation(api.messages.sendMessage, {
      eventId,
      participantId,
      content: "Yes, after the event!",
      replyToMessageId: messageId,
    });

    const messages = await t.query(api.messages.listMessages, { eventId });
    const reply = messages.find((m) => m.content === "Yes, after the event!");
    expect(reply?.replyTo).toEqual({
      messageId,
      deleted: false,
      authorDisplayName: "Ana",
      content: "Will slides be shared?",
    });
  });

  test("deleting a message removes it from every view and marks replies as deleted-original", async () => {
    const t = newTestInstance();
    const { eventId, participantId } = await setupEventWithParticipant(t);

    const { messageId } = await t.mutation(api.messages.sendMessage, {
      eventId,
      participantId,
      content: "Original",
    });
    await t.mutation(api.messages.sendMessage, {
      eventId,
      participantId,
      content: "A reply",
      replyToMessageId: messageId,
    });

    await t.mutation(api.messages.deleteMessage, { messageId, participantId });

    const messages = await t.query(api.messages.listMessages, { eventId });
    expect(messages.find((m) => m.content === "Original")).toBeUndefined();
    const reply = messages.find((m) => m.content === "A reply");
    expect(reply?.replyTo).toEqual({ messageId, deleted: true });
  });

  test("only the original author can delete a message", async () => {
    const t = newTestInstance();
    const { eventId, participantId } = await setupEventWithParticipant(t);
    const { participantId: otherParticipantId } = await t.mutation(api.participants.joinEvent, {
      eventId,
      displayName: "Rui",
    });

    const { messageId } = await t.mutation(api.messages.sendMessage, {
      eventId,
      participantId,
      content: "Mine",
    });

    await expect(
      t.mutation(api.messages.deleteMessage, {
        messageId,
        participantId: otherParticipantId,
      }),
    ).rejects.toThrow();
  });

  test("a participant is rate-limited after sending too many messages quickly", async () => {
    const t = newTestInstance();
    const { eventId, participantId } = await setupEventWithParticipant(t);

    for (let i = 0; i < 5; i++) {
      await t.mutation(api.messages.sendMessage, {
        eventId,
        participantId,
        content: `Message ${i}`,
      });
    }

    await expect(
      t.mutation(api.messages.sendMessage, {
        eventId,
        participantId,
        content: "One too many",
      }),
    ).rejects.toThrow(/RateLimited/);
  });
});
