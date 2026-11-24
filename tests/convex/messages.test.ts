import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { createModeratorSession, listVisibleMessages, newTestInstance } from "./testHelpers";

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

    const messages = await listVisibleMessages(t, eventId);
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

    const messages = await listVisibleMessages(t, eventId);
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

    const messages = await listVisibleMessages(t, eventId);
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

    const messages = await listVisibleMessages(t, eventId);
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

  test("a kicked participant can no longer send messages", async () => {
    const t = newTestInstance();
    const { eventId, participantId, sessionToken } = await setupEventWithParticipant(t);
    await t.mutation(api.participants.kickParticipant, { sessionToken, participantId });

    await expect(
      t.mutation(api.messages.sendMessage, { eventId, participantId, content: "Hello?" }),
    ).rejects.toThrow(/Kicked/);
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

describe("listMessages pagination", () => {
  // The per-participant rate limit (5 / 10s) would stop one sender, so use several.
  async function seed(t: ReturnType<typeof newTestInstance>, eventId: Id<"events">, count: number) {
    const ids: Id<"messages">[] = [];
    const senders: Id<"participants">[] = [];
    for (let i = 0; i < Math.ceil(count / 5); i++) {
      senders.push((await t.mutation(api.participants.joinEvent, { eventId, displayName: `P${i}` })).participantId);
    }
    for (let i = 0; i < count; i++) {
      const r = await t.mutation(api.messages.sendMessage, {
        eventId,
        participantId: senders[Math.floor(i / 5)],
        content: `m${i}`,
      });
      ids.push(r.messageId);
    }
    return ids;
  }

  test("pages come newest first and together cover every message exactly once", async () => {
    const t = newTestInstance();
    const { eventId } = await setupEventWithParticipant(t);
    await seed(t, eventId, 23);

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    for (;;) {
      const res: Awaited<ReturnType<typeof t.query<typeof api.messages.listMessages>>> = await t.query(
        api.messages.listMessages,
        { eventId, paginationOpts: { numItems: 10, cursor } },
      );
      seen.push(...res.page.map((m) => m.content));
      pages++;
      if (res.isDone) break;
      cursor = res.continueCursor;
    }
    expect(pages).toBe(3);
    expect(seen).toEqual(Array.from({ length: 23 }, (_, i) => `m${22 - i}`));
  });

  test("a client cannot request more than 100 messages in one page", async () => {
    const t = newTestInstance();
    const { eventId } = await setupEventWithParticipant(t);
    await seed(t, eventId, 105);
    const res = await t.query(api.messages.listMessages, {
      eventId,
      paginationOpts: { numItems: 100_000, cursor: null },
    });
    expect(res.page).toHaveLength(100);
    expect(res.isDone).toBe(false);
  });

  test("deleted and held messages are skipped without breaking paging", async () => {
    const t = newTestInstance();
    const { eventId, participantId, sessionToken } = await setupEventWithParticipant(t);
    const ids = await seed(t, eventId, 6);
    await t.mutation(api.messages.deleteMessage, {
      messageId: ids[2],
      participantId: (await t.run(async (ctx) => (await ctx.db.get(ids[2]))!.participantId)),
    });
    await t.run(async (ctx) => ctx.db.patch(ids[3], { moderationStatus: "pending" }));

    const all = await listVisibleMessages(t, eventId);
    expect(all.map((m) => m.content)).toEqual(["m0", "m1", "m4", "m5"]);
    expect(participantId).toBeDefined();
    expect(sessionToken).toBeDefined();
  });

  test("a reply still quotes an original that is on an older page", async () => {
    const t = newTestInstance();
    const { eventId } = await setupEventWithParticipant(t);
    const ids = await seed(t, eventId, 12);
    const replier = (await t.mutation(api.participants.joinEvent, { eventId, displayName: "Rui" })).participantId;
    await t.mutation(api.messages.sendMessage, {
      eventId,
      participantId: replier,
      content: "answer",
      replyToMessageId: ids[0],
    });

    const newest = await t.query(api.messages.listMessages, {
      eventId,
      paginationOpts: { numItems: 3, cursor: null },
    });
    expect(newest.page[0].content).toBe("answer");
    expect(newest.page[0].replyTo).toMatchObject({ deleted: false, content: "m0" });
    expect(newest.page.map((m) => m.content)).not.toContain("m0");
  });
});
