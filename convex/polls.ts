import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireModerator } from "./lib/requireModerator";
import {
  MAX_POLL_OPTION_LENGTH,
  MAX_POLL_QUESTION_LENGTH,
  assertMaxLength,
} from "./lib/limits";

/** Validates and normalizes (trims) a poll's question and options. */
function validatePollInput(rawQuestion: string, rawOptions: string[]) {
  const question = rawQuestion.trim();
  const options = rawOptions.map((o) => o.trim());
  if (question.length === 0) {
    throw new ConvexError("A poll needs a question.");
  }
  assertMaxLength(question, MAX_POLL_QUESTION_LENGTH, "The question");
  if (options.length < 2 || options.length > 6) {
    throw new ConvexError("A poll must have between 2 and 6 options.");
  }
  if (options.some((o) => o.length === 0)) {
    throw new ConvexError("Poll options cannot be empty.");
  }
  for (const o of options) assertMaxLength(o, MAX_POLL_OPTION_LENGTH, "An option");
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
    throw new ConvexError("Poll options must be different from each other.");
  }
  return { question, options };
}

export const createAndStartPoll = mutation({
  args: {
    sessionToken: v.string(),
    eventId: v.id("events"),
    question: v.string(),
    options: v.array(v.string()),
    revealMode: v.union(v.literal("live"), v.literal("atEnd")),
  },
  handler: async (ctx, { sessionToken, eventId, question: rawQuestion, options: rawOptions, revealMode }) => {
    await requireModerator(ctx, sessionToken);
    const { question, options } = validatePollInput(rawQuestion, rawOptions);
    const event = await ctx.db.get(eventId);
    if (event === null) {
      throw new ConvexError("Event not found.");
    }
    if (event.status !== "active") {
      throw new ConvexError("This event has ended.");
    }
    if (event.activePollId !== null) {
      throw new ConvexError("Another poll is already active for this event.");
    }
    const pollId = await ctx.db.insert("polls", {
      eventId,
      question,
      options,
      revealMode,
      status: "active",
      resultsRevealed: false,
      startedAt: Date.now(),
      endedAt: null,
    });
    await ctx.db.patch(eventId, { activePollId: pollId });
    return { pollId };
  },
});

export const createDraftPoll = mutation({
  args: {
    sessionToken: v.string(),
    eventId: v.id("events"),
    question: v.string(),
    options: v.array(v.string()),
    revealMode: v.union(v.literal("live"), v.literal("atEnd")),
  },
  handler: async (ctx, { sessionToken, eventId, question: rawQuestion, options: rawOptions, revealMode }) => {
    await requireModerator(ctx, sessionToken);
    const { question, options } = validatePollInput(rawQuestion, rawOptions);
    const event = await ctx.db.get(eventId);
    if (event === null) {
      throw new ConvexError("Event not found.");
    }
    const pollId = await ctx.db.insert("polls", {
      eventId,
      question,
      options,
      revealMode,
      status: "draft",
      resultsRevealed: false,
      startedAt: null,
      endedAt: null,
    });
    return { pollId };
  },
});

export const listDraftPolls = query({
  args: { sessionToken: v.string(), eventId: v.id("events") },
  handler: async (ctx, { sessionToken, eventId }) => {
    await requireModerator(ctx, sessionToken);
    const polls = await ctx.db
      .query("polls")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();
    return polls
      .filter((p) => p.status === "draft")
      .map((p) => ({
        pollId: p._id,
        question: p.question,
        options: p.options,
        revealMode: p.revealMode,
      }));
  },
});

export const deleteDraftPoll = mutation({
  args: { sessionToken: v.string(), pollId: v.id("polls") },
  handler: async (ctx, { sessionToken, pollId }) => {
    await requireModerator(ctx, sessionToken);
    const poll = await ctx.db.get(pollId);
    if (poll === null) {
      throw new ConvexError("Poll not found.");
    }
    if (poll.status !== "draft") {
      throw new ConvexError("Only prepared (draft) polls can be deleted.");
    }
    await ctx.db.delete(pollId);
    return {};
  },
});

/**
 * Takes a prepared poll live. Only one poll may be active per event: if another
 * is already active, the caller must pass `replaceActive: true` (after the
 * moderator confirmed) — the active poll is then ended and this one starts.
 */
export const activatePoll = mutation({
  args: {
    sessionToken: v.string(),
    pollId: v.id("polls"),
    replaceActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { sessionToken, pollId, replaceActive }) => {
    await requireModerator(ctx, sessionToken);
    const poll = await ctx.db.get(pollId);
    if (poll === null) {
      throw new ConvexError("Poll not found.");
    }
    if (poll.status !== "draft") {
      throw new ConvexError("Only prepared (draft) polls can be activated.");
    }
    const event = await ctx.db.get(poll.eventId);
    if (event === null) {
      throw new ConvexError("Event not found.");
    }
    if (event.status !== "active") {
      throw new ConvexError("This event has ended.");
    }
    if (event.activePollId !== null) {
      if (!replaceActive) {
        throw new ConvexError("Another poll is already active for this event.");
      }
      await ctx.db.patch(event.activePollId, { status: "ended", endedAt: Date.now() });
    }
    await ctx.db.patch(pollId, { status: "active", startedAt: Date.now() });
    await ctx.db.patch(event._id, { activePollId: pollId });
    return {};
  },
});

export const castVote = mutation({
  args: {
    pollId: v.id("polls"),
    participantId: v.id("participants"),
    optionIndex: v.number(),
  },
  handler: async (ctx, { pollId, participantId, optionIndex }) => {
    const poll = await ctx.db.get(pollId);
    if (poll === null || poll.status !== "active") {
      throw new ConvexError("This poll is no longer accepting votes.");
    }
    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      throw new ConvexError("Invalid option.");
    }
    const event = await ctx.db.get(poll.eventId);
    if (event === null || event.status === "ended") {
      throw new ConvexError("This event has ended.");
    }
    const participant = await ctx.db.get(participantId);
    if (participant === null || participant.eventId !== poll.eventId) {
      throw new ConvexError("Participant not found for this event.");
    }
    if (participant.kickedAt) {
      throw new ConvexError("Kicked: you've been removed from this event by the moderator.");
    }
    const existing = await ctx.db
      .query("pollVotes")
      .withIndex("by_poll_participant", (q) =>
        q.eq("pollId", pollId).eq("participantId", participantId),
      )
      .first();
    if (existing !== null) {
      throw new ConvexError("You have already voted in this poll.");
    }
    await ctx.db.insert("pollVotes", { pollId, participantId, optionIndex, votedAt: Date.now() });
    return {};
  },
});

/**
 * Returns the event's current or most-recently-ended poll (not just "active" —
 * an `atEnd` poll's final results must still be readable after it ends, since
 * `events.activePollId` is cleared on `endPoll`). `isActive` is the "poll in
 * progress" highlight signal (FR-019); a `null` result means no poll has run yet.
 */
export const getActivePoll = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (event === null) {
      return null;
    }
    let poll = event.activePollId !== null ? await ctx.db.get(event.activePollId) : null;
    if (poll === null) {
      // No active poll: fall back to the most recently ended one (drafts never count).
      const polls = await ctx.db
        .query("polls")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .collect();
      poll =
        polls
          .filter((p) => p.status === "ended")
          .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))[0] ?? null;
    }
    if (poll === null) {
      return null;
    }

    const resultsVisible =
      poll.revealMode === "live" || poll.resultsRevealed || poll.status === "ended";

    let counts: number[] | undefined;
    if (resultsVisible) {
      const votes = await ctx.db
        .query("pollVotes")
        .withIndex("by_poll_participant", (q) => q.eq("pollId", poll._id))
        .collect();
      counts = new Array(poll.options.length).fill(0);
      for (const vote of votes) {
        counts[vote.optionIndex]++;
      }
    }

    return {
      pollId: poll._id,
      question: poll.question,
      options: poll.options,
      revealMode: poll.revealMode,
      isActive: poll.status === "active",
      resultsVisible,
      counts,
    };
  },
});

export const revealResults = mutation({
  args: { sessionToken: v.string(), pollId: v.id("polls") },
  handler: async (ctx, { sessionToken, pollId }) => {
    await requireModerator(ctx, sessionToken);
    await ctx.db.patch(pollId, { resultsRevealed: true });
    return {};
  },
});

export const endPoll = mutation({
  args: { sessionToken: v.string(), pollId: v.id("polls") },
  handler: async (ctx, { sessionToken, pollId }) => {
    await requireModerator(ctx, sessionToken);
    const poll = await ctx.db.get(pollId);
    if (poll === null) {
      throw new ConvexError("Poll not found.");
    }
    if (poll.status === "draft") {
      throw new ConvexError("A prepared poll has not started; delete it instead.");
    }
    if (poll.status === "ended") {
      // Already ended (double click / stale tab): don't rewrite endedAt, which
      // decides which poll counts as "the most recent one".
      return {};
    }
    await ctx.db.patch(pollId, { status: "ended", endedAt: Date.now() });
    const event = await ctx.db.get(poll.eventId);
    if (event !== null && event.activePollId === pollId) {
      await ctx.db.patch(poll.eventId, { activePollId: null });
    }
    return {};
  },
});

/**
 * Moderator-only history of every poll that has gone live (active or ended),
 * newest first, with full results regardless of the poll's `revealMode`.
 */
export const listPollHistory = query({
  args: { sessionToken: v.string(), eventId: v.id("events") },
  handler: async (ctx, { sessionToken, eventId }) => {
    await requireModerator(ctx, sessionToken);
    const polls = await ctx.db
      .query("polls")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();
    const started = polls
      .filter((p) => p.status !== "draft")
      .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
    return await Promise.all(
      started.map(async (poll) => {
        const votes = await ctx.db
          .query("pollVotes")
          .withIndex("by_poll_participant", (q) => q.eq("pollId", poll._id))
          .collect();
        const counts: number[] = new Array(poll.options.length).fill(0);
        for (const vote of votes) {
          counts[vote.optionIndex]++;
        }
        return {
          pollId: poll._id,
          question: poll.question,
          options: poll.options,
          revealMode: poll.revealMode,
          isActive: poll.status === "active",
          startedAt: poll.startedAt,
          endedAt: poll.endedAt,
          counts,
          totalVotes: votes.length,
        };
      }),
    );
  },
});
