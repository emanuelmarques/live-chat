import { describe, expect, test } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { createModeratorSession, newTestInstance } from "./testHelpers";

async function setupEventWithTwoParticipants(t: ReturnType<typeof newTestInstance>) {
  const sessionToken = await createModeratorSession(t);
  const { eventId } = await t.mutation(api.events.createEvent, {
    sessionToken,
    name: "Podcast Live",
  });
  const a = await t.mutation(api.participants.joinEvent, { eventId, displayName: "Ana" });
  const b = await t.mutation(api.participants.joinEvent, { eventId, displayName: "Rui" });
  return { eventId, sessionToken, participantA: a.participantId, participantB: b.participantId };
}

describe("polls", () => {
  test("createAndStartPoll validates 2-6 options", async () => {
    const t = newTestInstance();
    const sessionToken = await createModeratorSession(t);
    const { eventId } = await t.mutation(api.events.createEvent, { sessionToken, name: "E" });

    await expect(
      t.mutation(api.polls.createAndStartPoll, {
        sessionToken,
        eventId,
        question: "Q?",
        options: ["only one"],
        revealMode: "live",
      }),
    ).rejects.toThrow();

    const { pollId } = await t.mutation(api.polls.createAndStartPoll, {
      sessionToken,
      eventId,
      question: "Q?",
      options: ["A", "B"],
      revealMode: "live",
    });
    expect(pollId).toBeDefined();
  });

  test("at most one active poll per event", async () => {
    const t = newTestInstance();
    const { eventId, sessionToken } = await setupEventWithTwoParticipants(t);
    await t.mutation(api.polls.createAndStartPoll, {
      sessionToken,
      eventId,
      question: "First?",
      options: ["A", "B"],
      revealMode: "live",
    });

    await expect(
      t.mutation(api.polls.createAndStartPoll, {
        sessionToken,
        eventId,
        question: "Second?",
        options: ["A", "B"],
        revealMode: "live",
      }),
    ).rejects.toThrow();
  });

  describe("prepared (draft) polls", () => {
    const draft = (eventId: Id<"events">, sessionToken: string, question = "Prepared?") => ({
      sessionToken,
      eventId,
      question,
      options: ["A", "B"],
      revealMode: "live" as const,
    });

    test("a draft is invisible to participants and cannot be voted on", async () => {
      const t = newTestInstance();
      const { eventId, sessionToken, participantA } = await setupEventWithTwoParticipants(t);
      const { pollId } = await t.mutation(api.polls.createDraftPoll, draft(eventId, sessionToken));

      expect(await t.query(api.polls.getActivePoll, { eventId })).toBeNull();
      const drafts = await t.query(api.polls.listDraftPolls, { sessionToken, eventId });
      expect(drafts.map((d) => d.pollId)).toEqual([pollId]);
      await expect(
        t.mutation(api.polls.castVote, { pollId, participantId: participantA, optionIndex: 0 }),
      ).rejects.toThrow();
    });

    test("activating a draft makes it live and removes it from the drafts list", async () => {
      const t = newTestInstance();
      const { eventId, sessionToken } = await setupEventWithTwoParticipants(t);
      const { pollId } = await t.mutation(api.polls.createDraftPoll, draft(eventId, sessionToken));

      await t.mutation(api.polls.activatePoll, { sessionToken, pollId });

      const live = await t.query(api.polls.getActivePoll, { eventId });
      expect(live?.pollId).toBe(pollId);
      expect(live?.isActive).toBe(true);
      expect(await t.query(api.polls.listDraftPolls, { sessionToken, eventId })).toEqual([]);
    });

    test("activating while another poll is active is refused unless replaceActive is set", async () => {
      const t = newTestInstance();
      const { eventId, sessionToken, participantA } = await setupEventWithTwoParticipants(t);
      const first = await t.mutation(api.polls.createAndStartPoll, draft(eventId, sessionToken, "First?"));
      await t.mutation(api.polls.castVote, {
        pollId: first.pollId,
        participantId: participantA,
        optionIndex: 0,
      });
      const { pollId } = await t.mutation(api.polls.createDraftPoll, draft(eventId, sessionToken));

      await expect(t.mutation(api.polls.activatePoll, { sessionToken, pollId })).rejects.toThrow(
        /already active/,
      );
      expect((await t.query(api.polls.getActivePoll, { eventId }))?.pollId).toBe(first.pollId);

      await t.mutation(api.polls.activatePoll, { sessionToken, pollId, replaceActive: true });
      const live = await t.query(api.polls.getActivePoll, { eventId });
      expect(live?.pollId).toBe(pollId);
      expect(live?.isActive).toBe(true);
      // The replaced poll was closed, not deleted, and no longer accepts votes.
      await expect(
        t.mutation(api.polls.castVote, {
          pollId: first.pollId,
          participantId: participantA,
          optionIndex: 1,
        }),
      ).rejects.toThrow();
    });

    test("a draft activated after a newer poll ended is still the one shown", async () => {
      const t = newTestInstance();
      const { eventId, sessionToken } = await setupEventWithTwoParticipants(t);
      const old = await t.mutation(api.polls.createDraftPoll, draft(eventId, sessionToken, "Old draft"));
      const newer = await t.mutation(api.polls.createAndStartPoll, draft(eventId, sessionToken, "Newer"));
      await t.mutation(api.polls.endPoll, { sessionToken, pollId: newer.pollId });

      await t.mutation(api.polls.activatePoll, { sessionToken, pollId: old.pollId });
      expect((await t.query(api.polls.getActivePoll, { eventId }))?.pollId).toBe(old.pollId);
    });

    test("drafts can be deleted, but active polls cannot be deleted this way", async () => {
      const t = newTestInstance();
      const { eventId, sessionToken } = await setupEventWithTwoParticipants(t);
      const { pollId } = await t.mutation(api.polls.createDraftPoll, draft(eventId, sessionToken));
      await t.mutation(api.polls.deleteDraftPoll, { sessionToken, pollId });
      expect(await t.query(api.polls.listDraftPolls, { sessionToken, eventId })).toEqual([]);

      const live = await t.mutation(api.polls.createAndStartPoll, draft(eventId, sessionToken));
      await expect(
        t.mutation(api.polls.deleteDraftPoll, { sessionToken, pollId: live.pollId }),
      ).rejects.toThrow();
    });
  });

  test("a participant can only vote once per poll", async () => {
    const t = newTestInstance();
    const { eventId, sessionToken, participantA } = await setupEventWithTwoParticipants(t);
    const { pollId } = await t.mutation(api.polls.createAndStartPoll, {
      sessionToken,
      eventId,
      question: "Q?",
      options: ["A", "B"],
      revealMode: "live",
    });

    await t.mutation(api.polls.castVote, { pollId, participantId: participantA, optionIndex: 0 });
    await expect(
      t.mutation(api.polls.castVote, { pollId, participantId: participantA, optionIndex: 1 }),
    ).rejects.toThrow();
  });

  test("a kicked participant can no longer vote", async () => {
    const t = newTestInstance();
    const { eventId, sessionToken, participantA } = await setupEventWithTwoParticipants(t);
    const { pollId } = await t.mutation(api.polls.createAndStartPoll, {
      sessionToken,
      eventId,
      question: "Q?",
      options: ["A", "B"],
      revealMode: "live",
    });
    await t.mutation(api.participants.kickParticipant, { sessionToken, participantId: participantA });

    await expect(
      t.mutation(api.polls.castVote, { pollId, participantId: participantA, optionIndex: 0 }),
    ).rejects.toThrow(/Kicked/);
  });

  test("live reveal mode shows counts immediately as votes come in", async () => {
    const t = newTestInstance();
    const { eventId, sessionToken, participantA, participantB } =
      await setupEventWithTwoParticipants(t);
    const { pollId } = await t.mutation(api.polls.createAndStartPoll, {
      sessionToken,
      eventId,
      question: "Q?",
      options: ["A", "B"],
      revealMode: "live",
    });

    await t.mutation(api.polls.castVote, { pollId, participantId: participantA, optionIndex: 0 });

    const afterOne = await t.query(api.polls.getActivePoll, { eventId });
    expect(afterOne?.resultsVisible).toBe(true);
    expect(afterOne?.counts).toEqual([1, 0]);

    await t.mutation(api.polls.castVote, { pollId, participantId: participantB, optionIndex: 1 });
    const afterTwo = await t.query(api.polls.getActivePoll, { eventId });
    expect(afterTwo?.counts).toEqual([1, 1]);
  });

  test("atEnd reveal mode hides counts until revealed or the poll ends", async () => {
    const t = newTestInstance();
    const { eventId, sessionToken, participantA } = await setupEventWithTwoParticipants(t);
    const { pollId } = await t.mutation(api.polls.createAndStartPoll, {
      sessionToken,
      eventId,
      question: "Q?",
      options: ["A", "B"],
      revealMode: "atEnd",
    });
    await t.mutation(api.polls.castVote, { pollId, participantId: participantA, optionIndex: 0 });

    const whileHidden = await t.query(api.polls.getActivePoll, { eventId });
    expect(whileHidden?.resultsVisible).toBe(false);
    expect(whileHidden?.counts).toBeUndefined();

    await t.mutation(api.polls.revealResults, { sessionToken, pollId });
    const afterReveal = await t.query(api.polls.getActivePoll, { eventId });
    expect(afterReveal?.resultsVisible).toBe(true);
    expect(afterReveal?.counts).toEqual([1, 0]);
  });

  test("ending a poll clears the active/highlighted state but keeps final results readable", async () => {
    const t = newTestInstance();
    const { eventId, sessionToken, participantA } = await setupEventWithTwoParticipants(t);
    const { pollId } = await t.mutation(api.polls.createAndStartPoll, {
      sessionToken,
      eventId,
      question: "Q?",
      options: ["A", "B"],
      revealMode: "atEnd",
    });
    await t.mutation(api.polls.castVote, { pollId, participantId: participantA, optionIndex: 0 });

    await t.mutation(api.polls.endPoll, { sessionToken, pollId });

    const after = await t.query(api.polls.getActivePoll, { eventId });
    expect(after?.isActive).toBe(false);
    expect(after?.resultsVisible).toBe(true);
    expect(after?.counts).toEqual([1, 0]);

    await expect(
      t.mutation(api.polls.castVote, { pollId, participantId: participantA, optionIndex: 1 }),
    ).rejects.toThrow();

    // The active-poll slot is free again for a new poll.
    await expect(
      t.mutation(api.polls.createAndStartPoll, {
        sessionToken,
        eventId,
        question: "Next?",
        options: ["A", "B"],
        revealMode: "live",
      }),
    ).resolves.toBeDefined();
  });
});

describe("poll history", () => {
  test("lists started polls newest first with full counts, excluding drafts", async () => {
    const t = newTestInstance();
    const { eventId, sessionToken, participantA, participantB } =
      await setupEventWithTwoParticipants(t);
    const base = { sessionToken, eventId, options: ["A", "B"], revealMode: "atEnd" as const };
    const first = await t.mutation(api.polls.createAndStartPoll, { ...base, question: "First?" });
    await t.mutation(api.polls.castVote, { pollId: first.pollId, participantId: participantA, optionIndex: 0 });
    await t.mutation(api.polls.castVote, { pollId: first.pollId, participantId: participantB, optionIndex: 0 });
    await t.mutation(api.polls.endPoll, { sessionToken, pollId: first.pollId });
    await t.mutation(api.polls.createDraftPoll, { ...base, question: "Draft?" });
    const second = await t.mutation(api.polls.createAndStartPoll, { ...base, question: "Second?" });

    const history = await t.query(api.polls.listPollHistory, { sessionToken, eventId });
    expect(history.map((h) => h.pollId)).toEqual([second.pollId, first.pollId]);
    expect(history[0].isActive).toBe(true);
    expect(history[1].counts).toEqual([2, 0]);
    expect(history[1].totalVotes).toBe(2);
    // Hidden from participants while an atEnd poll is live, but visible to the moderator.
    expect(history[0].counts).toEqual([0, 0]);
  });
});
