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

describe("moderation", () => {
  test("a message matching no block-list entry is visible immediately", async () => {
    const t = newTestInstance();
    const { eventId, participantId } = await setupEventWithParticipant(t);

    await t.mutation(api.messages.sendMessage, { eventId, participantId, content: "Hello there" });

    const messages = await t.query(api.messages.listMessages, { eventId });
    expect(messages).toHaveLength(1);
  });

  test("a message matching a block-list entry is held pending, never directly rejected", async () => {
    const t = newTestInstance();
    const { eventId, participantId, sessionToken } = await setupEventWithParticipant(t);

    await t.mutation(api.moderation.addBlockListEntry, { sessionToken, term: "bannedword" });
    await t.mutation(api.messages.sendMessage, {
      eventId,
      participantId,
      content: "this has a BannedWord in it",
    });

    const visible = await t.query(api.messages.listMessages, { eventId });
    expect(visible).toHaveLength(0);

    const pending = await t.query(api.moderation.listPending, { sessionToken, eventId });
    expect(pending).toHaveLength(1);
    expect(pending[0].content).toContain("BannedWord");

    const own = await t.query(api.messages.listOwnPendingOrRejected, { eventId, participantId });
    expect(own[0].moderationStatus).toBe("pending");
  });

  test("approveMessage makes a held message visible to everyone", async () => {
    const t = newTestInstance();
    const { eventId, participantId, sessionToken } = await setupEventWithParticipant(t);
    await t.mutation(api.moderation.addBlockListEntry, { sessionToken, term: "bannedword" });
    await t.mutation(api.messages.sendMessage, { eventId, participantId, content: "bannedword here" });

    const [pending] = await t.query(api.moderation.listPending, { sessionToken, eventId });
    await t.mutation(api.moderation.approveMessage, { sessionToken, messageId: pending.messageId });

    const visible = await t.query(api.messages.listMessages, { eventId });
    expect(visible).toHaveLength(1);
    const own = await t.query(api.messages.listOwnPendingOrRejected, { eventId, participantId });
    expect(own).toHaveLength(0);
  });

  test("rejectMessage never makes a held message visible to anyone", async () => {
    const t = newTestInstance();
    const { eventId, participantId, sessionToken } = await setupEventWithParticipant(t);
    await t.mutation(api.moderation.addBlockListEntry, { sessionToken, term: "bannedword" });
    await t.mutation(api.messages.sendMessage, { eventId, participantId, content: "bannedword here" });

    const [pending] = await t.query(api.moderation.listPending, { sessionToken, eventId });
    await t.mutation(api.moderation.rejectMessage, { sessionToken, messageId: pending.messageId });

    const visible = await t.query(api.messages.listMessages, { eventId });
    expect(visible).toHaveLength(0);
    const own = await t.query(api.messages.listOwnPendingOrRejected, { eventId, participantId });
    expect(own[0].moderationStatus).toBe("rejected");
  });

  test("removing a block-list entry only affects messages sent after the change", async () => {
    const t = newTestInstance();
    const { eventId, participantId, sessionToken } = await setupEventWithParticipant(t);
    const { entryId } = await t.mutation(api.moderation.addBlockListEntry, {
      sessionToken,
      term: "bannedword",
    });
    await t.mutation(api.messages.sendMessage, { eventId, participantId, content: "bannedword one" });

    await t.mutation(api.moderation.removeBlockListEntry, { sessionToken, entryId });
    await t.mutation(api.messages.sendMessage, { eventId, participantId, content: "bannedword two" });

    const pending = await t.query(api.moderation.listPending, { sessionToken, eventId });
    expect(pending).toHaveLength(1);
    expect(pending[0].content).toBe("bannedword one");

    const visible = await t.query(api.messages.listMessages, { eventId });
    expect(visible.map((m) => m.content)).toEqual(["bannedword two"]);
  });

  test("moderation functions require moderator auth", async () => {
    const t = newTestInstance();
    const { eventId } = await setupEventWithParticipant(t);
    await expect(
      t.mutation(api.moderation.addBlockListEntry, { sessionToken: "bogus", term: "x" }),
    ).rejects.toThrow();
    await expect(
      t.query(api.moderation.listPending, { sessionToken: "bogus", eventId }),
    ).rejects.toThrow();
  });
});

describe("moderator chat view: delete and highlight", () => {
  async function chatSetup() {
    const t = newTestInstance();
    const sessionToken = await createModeratorSession(t);
    const { eventId } = await t.mutation(api.events.createEvent, { sessionToken, name: "Live" });
    const { participantId } = await t.mutation(api.participants.joinEvent, { eventId, displayName: "Ana" });
    const send = async (content: string) =>
      (await t.mutation(api.messages.sendMessage, { eventId, participantId, content })).messageId;
    return { t, sessionToken, eventId, send };
  }

  test("highlight shows on the projector query without touching the participant chat", async () => {
    const { t, sessionToken, eventId, send } = await chatSetup();
    const a = await send("first");
    const b = await send("second");

    await t.mutation(api.moderation.highlightMessage, { sessionToken, messageId: a });
    await t.mutation(api.moderation.highlightMessage, { sessionToken, messageId: b });

    const highlighted = await t.query(api.messages.getHighlightedMessage, { eventId });
    expect(highlighted?.messageId).toBe(b);
    const chat = await t.query(api.messages.listMessages, { eventId });
    expect(chat.map((m) => m.content)).toEqual(["first", "second"]);

    await t.mutation(api.moderation.clearHighlight, { sessionToken, eventId });
    expect(await t.query(api.messages.getHighlightedMessage, { eventId })).toBeNull();
  });

  test("moderator can delete any message, which also clears its highlight", async () => {
    const { t, sessionToken, eventId, send } = await chatSetup();
    const a = await send("bad");
    await t.mutation(api.moderation.highlightMessage, { sessionToken, messageId: a });
    await t.mutation(api.moderation.deleteMessageAsModerator, { sessionToken, messageId: a });

    expect(await t.query(api.messages.listMessages, { eventId })).toHaveLength(0);
    expect(await t.query(api.messages.getHighlightedMessage, { eventId })).toBeNull();
  });

  test("requires a moderator session and a visible message", async () => {
    const { t, sessionToken, send } = await chatSetup();
    const a = await send("hi");
    await expect(
      t.mutation(api.moderation.highlightMessage, { sessionToken: "nope", messageId: a }),
    ).rejects.toThrow();
    await t.mutation(api.moderation.deleteMessageAsModerator, { sessionToken, messageId: a });
    await expect(
      t.mutation(api.moderation.highlightMessage, { sessionToken, messageId: a }),
    ).rejects.toThrow(/visible/);
  });
});
