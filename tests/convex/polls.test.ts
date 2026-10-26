import { describe, expect, test } from "vitest";
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
