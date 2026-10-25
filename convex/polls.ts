import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireModerator } from "./lib/requireModerator";

export const createAndStartPoll = mutation({
  args: {
    sessionToken: v.string(),
    eventId: v.id("events"),
    question: v.string(),
    options: v.array(v.string()),
    revealMode: v.union(v.literal("live"), v.literal("atEnd")),
  },
  handler: async (ctx, { sessionToken, eventId, question, options, revealMode }) => {
    await requireModerator(ctx, sessionToken);
    if (options.length < 2 || options.length > 6) {
      throw new Error("A poll must have between 2 and 6 options.");
    }
    const event = await ctx.db.get(eventId);
    if (event === null) {
      throw new Error("Event not found.");
    }
    if (event.activePollId !== null) {
      throw new Error("Another poll is already active for this event.");
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

export const castVote = mutation({
  args: {
    pollId: v.id("polls"),
    participantId: v.id("participants"),
    optionIndex: v.number(),
  },
  handler: async (ctx, { pollId, participantId, optionIndex }) => {
    const poll = await ctx.db.get(pollId);
    if (poll === null || poll.status !== "active") {
      throw new Error("This poll is no longer accepting votes.");
    }
    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      throw new Error("Invalid option.");
    }
    const existing = await ctx.db
      .query("pollVotes")
      .withIndex("by_poll_participant", (q) =>
        q.eq("pollId", pollId).eq("participantId", participantId),
      )
      .first();
    if (existing !== null) {
      throw new Error("You have already voted in this poll.");
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
    const [poll] = await ctx.db
      .query("polls")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .order("desc")
      .take(1);
    if (poll === undefined) {
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
      throw new Error("Poll not found.");
    }
    await ctx.db.patch(pollId, { status: "ended", endedAt: Date.now() });
    const event = await ctx.db.get(poll.eventId);
    if (event !== null && event.activePollId === pollId) {
      await ctx.db.patch(poll.eventId, { activePollId: null });
    }
    return {};
  },
});
