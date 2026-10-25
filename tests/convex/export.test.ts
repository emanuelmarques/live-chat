import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { createModeratorSession, newTestInstance } from "./testHelpers";

describe("export", () => {
  test("exportChatCsv includes only currently-visible, non-deleted messages", async () => {
    const t = newTestInstance();
    const sessionToken = await createModeratorSession(t);
    const { eventId } = await t.mutation(api.events.createEvent, {
      sessionToken,
      name: "Podcast Live",
    });
    const { participantId } = await t.mutation(api.participants.joinEvent, {
      eventId,
      displayName: "Ana",
    });

    await t.mutation(api.messages.sendMessage, {
      eventId,
      participantId,
      content: "Keep me",
    });
    const { messageId: toDelete } = await t.mutation(api.messages.sendMessage, {
      eventId,
      participantId,
      content: "Delete me",
    });
    await t.mutation(api.messages.deleteMessage, { messageId: toDelete, participantId });

    await t.mutation(api.moderation.addBlockListEntry, { sessionToken, term: "bannedword" });
    await t.mutation(api.messages.sendMessage, {
      eventId,
      participantId,
      content: "bannedword stays pending",
    });

    const { csv } = await t.query(api.export.exportChatCsv, { sessionToken, eventId });
    expect(csv).toContain("Keep me");
    expect(csv).not.toContain("Delete me");
    expect(csv).not.toContain("stays pending");
    expect(csv.split("\n")).toHaveLength(2); // header + 1 visible message
  });

  test("exportChatCsv works on a live (not-yet-ended) event", async () => {
    const t = newTestInstance();
    const sessionToken = await createModeratorSession(t);
    const { eventId } = await t.mutation(api.events.createEvent, {
      sessionToken,
      name: "Still live",
    });
    const { csv } = await t.query(api.export.exportChatCsv, { sessionToken, eventId });
    expect(csv).toContain("sender,content,sentAt");
  });

  test("exportChatCsv never mixes in another event's messages", async () => {
    const t = newTestInstance();
    const sessionToken = await createModeratorSession(t);
    const { eventId: eventA } = await t.mutation(api.events.createEvent, {
      sessionToken,
      name: "Event A",
    });
    const { eventId: eventB } = await t.mutation(api.events.createEvent, {
      sessionToken,
      name: "Event B",
    });
    const { participantId: pA } = await t.mutation(api.participants.joinEvent, {
      eventId: eventA,
      displayName: "Ana",
    });
    const { participantId: pB } = await t.mutation(api.participants.joinEvent, {
      eventId: eventB,
      displayName: "Rui",
    });
    await t.mutation(api.messages.sendMessage, {
      eventId: eventA,
      participantId: pA,
      content: "Only in A",
    });
    await t.mutation(api.messages.sendMessage, {
      eventId: eventB,
      participantId: pB,
      content: "Only in B",
    });

    const { csv } = await t.query(api.export.exportChatCsv, { sessionToken, eventId: eventA });
    expect(csv).toContain("Only in A");
    expect(csv).not.toContain("Only in B");
  });

  test("exportChatCsv requires moderator auth", async () => {
    const t = newTestInstance();
    const sessionToken = await createModeratorSession(t);
    const { eventId } = await t.mutation(api.events.createEvent, { sessionToken, name: "E" });
    await expect(
      t.query(api.export.exportChatCsv, { sessionToken: "bogus", eventId }),
    ).rejects.toThrow();
  });
});
