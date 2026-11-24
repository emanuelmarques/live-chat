import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { toCsvRow } from "../../convex/lib/csv";
import { createModeratorSession, listVisibleMessages, newTestInstance } from "./testHelpers";

async function setup() {
  const t = newTestInstance();
  const sessionToken = await createModeratorSession(t);
  const mk = async (name: string) => {
    const { eventId } = await t.mutation(api.events.createEvent, { sessionToken, name });
    const p = await t.mutation(api.participants.joinEvent, { eventId, displayName: "Ana" });
    return { eventId, pid: p.participantId };
  };
  return { t, sessionToken, A: await mk("A"), B: await mk("B") };
}

const pollArgs = (sessionToken: string, eventId: Id<"events">, options = ["a", "b"]) => ({
  sessionToken,
  eventId,
  question: "Q?",
  options,
  revealMode: "live" as const,
});

describe("poll voting is scoped to the poll's event", () => {
  test("a participant of another event cannot vote", async () => {
    const { t, sessionToken, A, B } = await setup();
    const { pollId } = await t.mutation(api.polls.createAndStartPoll, pollArgs(sessionToken, A.eventId));
    await expect(
      t.mutation(api.polls.castVote, { pollId, participantId: B.pid, optionIndex: 0 }),
    ).rejects.toThrow(/Participant not found/);
  });

  test("a nonexistent participant cannot vote", async () => {
    const { t, sessionToken, A } = await setup();
    const { pollId } = await t.mutation(api.polls.createAndStartPoll, pollArgs(sessionToken, A.eventId));
    const ghost = await t.run(async (ctx) => {
      const id = await ctx.db.insert("participants", {
        eventId: A.eventId,
        displayName: "g",
        joinedAt: 0,
        kickedAt: null,
      });
      await ctx.db.delete(id);
      return id;
    });
    await expect(
      t.mutation(api.polls.castVote, { pollId, participantId: ghost, optionIndex: 0 }),
    ).rejects.toThrow(/Participant not found/);
  });
});

describe("ending an event closes its poll", () => {
  test("poll becomes ended, can't be voted on, and no poll can start", async () => {
    const { t, sessionToken, A } = await setup();
    const { pollId } = await t.mutation(api.polls.createAndStartPoll, pollArgs(sessionToken, A.eventId));
    await t.mutation(api.events.endEvent, { sessionToken, eventId: A.eventId });

    const poll = await t.query(api.polls.getActivePoll, { eventId: A.eventId });
    expect(poll?.isActive).toBe(false);
    await expect(
      t.mutation(api.polls.castVote, { pollId, participantId: A.pid, optionIndex: 0 }),
    ).rejects.toThrow(/no longer accepting|ended/);
    await expect(
      t.mutation(api.polls.createAndStartPoll, pollArgs(sessionToken, A.eventId)),
    ).rejects.toThrow(/ended/);
  });
});

describe("poll input validation", () => {
  test("rejects empty, whitespace-only and duplicate options; trims the rest", async () => {
    const { t, sessionToken, A } = await setup();
    await expect(
      t.mutation(api.polls.createDraftPoll, pollArgs(sessionToken, A.eventId, ["", "b"])),
    ).rejects.toThrow(/empty/);
    await expect(
      t.mutation(api.polls.createDraftPoll, pollArgs(sessionToken, A.eventId, ["a", "   "])),
    ).rejects.toThrow(/empty/);
    await expect(
      t.mutation(api.polls.createDraftPoll, pollArgs(sessionToken, A.eventId, ["Yes", " yes "])),
    ).rejects.toThrow(/different/);
    await t.mutation(api.polls.createDraftPoll, pollArgs(sessionToken, A.eventId, [" Yes ", "No"]));
    const drafts = await t.query(api.polls.listDraftPolls, { sessionToken, eventId: A.eventId });
    expect(drafts[0].options).toEqual(["Yes", "No"]);
  });

  test("rejects over-long question and options", async () => {
    const { t, sessionToken, A } = await setup();
    await expect(
      t.mutation(api.polls.createDraftPoll, {
        ...pollArgs(sessionToken, A.eventId),
        question: "q".repeat(201),
      }),
    ).rejects.toThrow(/too long/);
    await expect(
      t.mutation(api.polls.createDraftPoll, pollArgs(sessionToken, A.eventId, ["a", "o".repeat(101)])),
    ).rejects.toThrow(/too long/);
  });

  test("endPoll on an already-ended poll keeps its endedAt (and 'latest poll' order)", async () => {
    const { t, sessionToken, A } = await setup();
    const p1 = await t.mutation(api.polls.createAndStartPoll, {
      ...pollArgs(sessionToken, A.eventId),
      question: "first",
    });
    await t.mutation(api.polls.endPoll, { sessionToken, pollId: p1.pollId });
    await new Promise((r) => setTimeout(r, 5)); // distinct endedAt values
    const p2 = await t.mutation(api.polls.createAndStartPoll, {
      ...pollArgs(sessionToken, A.eventId),
      question: "second",
    });
    await t.mutation(api.polls.endPoll, { sessionToken, pollId: p2.pollId });
    await new Promise((r) => setTimeout(r, 5));
    await t.mutation(api.polls.endPoll, { sessionToken, pollId: p1.pollId }); // stale tab
    const latest = await t.query(api.polls.getActivePoll, { eventId: A.eventId });
    expect(latest?.question).toBe("second");
  });
});

describe("size limits", () => {
  test("message, display name, event name are capped", async () => {
    const { t, sessionToken, A } = await setup();
    await expect(
      t.mutation(api.messages.sendMessage, {
        eventId: A.eventId,
        participantId: A.pid,
        content: "x".repeat(1001),
      }),
    ).rejects.toThrow(/too long/);
    await t.mutation(api.messages.sendMessage, {
      eventId: A.eventId,
      participantId: A.pid,
      content: "x".repeat(1000),
    });
    await expect(
      t.mutation(api.participants.joinEvent, { eventId: A.eventId, displayName: "n".repeat(41) }),
    ).rejects.toThrow(/too long/);
    await expect(
      t.mutation(api.events.createEvent, { sessionToken, name: "e".repeat(101) }),
    ).rejects.toThrow(/too long/);
    await expect(t.mutation(api.events.createEvent, { sessionToken, name: "   " })).rejects.toThrow(
      /needs a name/,
    );
  });
});

describe("message reactions are rate limited", () => {
  test("adding more than 20 reactions in 10s is refused; removing is still allowed", async () => {
    const { t, A } = await setup();
    const { messageId } = await t.mutation(api.messages.sendMessage, {
      eventId: A.eventId,
      participantId: A.pid,
      content: "hi",
    });
    const emojis = ["👍", "👎", "❤️", "🎉", "😂", "👏", "😮", "🔥", "💯"];
    const msgs = [messageId];
    // 9 emojis per message → 3 messages are enough for 20+ adds (message limit is 5 per 10s).
    for (let i = 0; i < 2; i++) {
      const { messageId: m } = await t.mutation(api.messages.sendMessage, {
        eventId: A.eventId,
        participantId: A.pid,
        content: `m${i}`,
      });
      msgs.push(m);
    }
    let adds = 0;
    for (const m of msgs) {
      for (const e of emojis) {
        if (adds >= 20) break;
        await t.mutation(api.messageReactions.toggleMessageReaction, { messageId: m, participantId: A.pid, emoji: e });
        adds++;
      }
    }
    expect(adds).toBe(20);
    await expect(
      t.mutation(api.messageReactions.toggleMessageReaction, {
        messageId: msgs[msgs.length - 1],
        participantId: A.pid,
        emoji: "❤️",
      }),
    ).rejects.toThrow(/RateLimited/);
    // Removing an existing reaction still works while rate limited.
    const res = await t.mutation(api.messageReactions.toggleMessageReaction, {
      messageId: msgs[0],
      participantId: A.pid,
      emoji: "👍",
    });
    expect(res.active).toBe(false);
  });
});

describe("CSV export is safe to open in a spreadsheet", () => {
  test("cells starting with = + - @ are neutralized, CR is quoted", () => {
    expect(toCsvRow(["=1+1", "+cmd", "-2", "@SUM(A1)"])).toBe("'=1+1,'+cmd,'-2,'@SUM(A1)");
    expect(toCsvRow(["a\rb"])).toBe('"a\rb"');
    expect(toCsvRow(['say "hi", ok'])).toBe('"say ""hi"", ok"');
    expect(toCsvRow(["plain", "2026-01-01T00:00:00.000Z"])).toBe("plain,2026-01-01T00:00:00.000Z");
  });
});

describe("participant ids are never exposed to other clients", () => {
  test("listMessages exposes opaque author keys, not participant ids", async () => {
    const { t, A } = await setup();
    const { messageId } = await t.mutation(api.messages.sendMessage, {
      eventId: A.eventId,
      participantId: A.pid,
      content: "hello",
    });
    await t.mutation(api.messageReactions.toggleMessageReaction, {
      messageId,
      participantId: A.pid,
      emoji: "👍",
    });
    const list = await listVisibleMessages(t, A.eventId);
    expect(JSON.stringify(list)).not.toContain(A.pid);
    const counts = await t.query(api.messageReactions.listMessageReactions, { eventId: A.eventId, since: 0 });
    expect(JSON.stringify(counts)).not.toContain(A.pid);

    // The author's own client can still recognise its messages via getParticipantStatus.
    const status = await t.query(api.participants.getParticipantStatus, {
      eventId: A.eventId,
      participantId: A.pid,
    });
    expect(list[0].authorKey).toBe(status?.authorKey);
  });
});

describe("moderator login lockout", () => {
  const creds = { email: "mod@example.com", password: "s3cret-password" };

  test("locks after 5 failures, even for the right password, and is case-insensitive on email", async () => {
    const t = newTestInstance();
    await createModeratorSession(t);
    for (let i = 0; i < 5; i++) {
      const r = await t.mutation(api.auth.login, { ...creds, password: "wrong" });
      expect(r).toMatchObject({ ok: false, reason: "invalid" });
    }
    const locked = await t.mutation(api.auth.login, { ...creds, email: " MOD@example.com " });
    expect(locked).toMatchObject({ ok: false, reason: "locked" });
    if (!locked.ok && locked.reason === "locked") {
      expect(locked.retryAfterSeconds).toBeGreaterThan(14 * 60);
    }
  });

  test("a successful login resets the counter; email case doesn't matter", async () => {
    const t = newTestInstance();
    await createModeratorSession(t);
    for (let i = 0; i < 4; i++) {
      await t.mutation(api.auth.login, { ...creds, password: "wrong" });
    }
    const ok = await t.mutation(api.auth.login, { ...creds, email: "Mod@Example.COM" });
    expect(ok.ok).toBe(true);
    for (let i = 0; i < 4; i++) {
      const r = await t.mutation(api.auth.login, { ...creds, password: "wrong" });
      expect(r).toMatchObject({ ok: false, reason: "invalid" });
    }
  });
});
