import { mutation, query, internalMutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// Fixed, curated set — mirrors Zoom-style reactions rather than a free-form
// emoji picker, so the flying overlay stays a small, recognizable vocabulary.
// Keep in sync with QUICK_REACTIONS in src/lib/reactions.ts.
export const QUICK_REACTIONS = ["👍", "❤️", "🎉", "😂", "👏", "😮", "🔥", "💯"] as const;

// How long a reaction stays eligible to be returned by listRecentReactions.
// Clients only animate reactions they haven't seen and that are fresh enough
// to still be "in flight" (see useReactionFlights), so this window just keeps
// the live query's result set small — it isn't itself the animation timer.
const RECENT_WINDOW_MS = 10_000;

// How long a reaction row lives before the prune cron deletes it. Reactions
// aren't part of the chat transcript (constitution Principle IV), so there's
// no reason to keep them beyond the live window above plus some slack.
const RETENTION_MS = 2 * 60_000;

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_REACTIONS = 20;

async function assertUnderRateLimit(ctx: MutationCtx, participantId: Id<"participants">) {
  const recent = await ctx.db
    .query("reactions")
    .withIndex("by_participant", (q) => q.eq("participantId", participantId))
    .order("desc")
    .take(RATE_LIMIT_MAX_REACTIONS);
  const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;
  const withinWindow = recent.filter((r) => r.sentAt >= windowStart).length;
  if (withinWindow >= RATE_LIMIT_MAX_REACTIONS) {
    throw new Error("RateLimited: you're reacting too quickly. Please wait a moment.");
  }
}

export const sendReaction = mutation({
  args: {
    eventId: v.id("events"),
    participantId: v.id("participants"),
    emoji: v.string(),
  },
  handler: async (ctx, { eventId, participantId, emoji }) => {
    if (!(QUICK_REACTIONS as readonly string[]).includes(emoji)) {
      throw new Error("Unsupported reaction emoji.");
    }
    const event = await ctx.db.get(eventId);
    if (event === null || event.status === "ended") {
      throw new Error("This event has ended.");
    }
    const participant = await ctx.db.get(participantId);
    if (participant === null || participant.eventId !== eventId) {
      throw new Error("Participant not found for this event.");
    }
    await assertUnderRateLimit(ctx, participantId);

    const reactionId = await ctx.db.insert("reactions", {
      eventId,
      participantId,
      emoji,
      sentAt: Date.now(),
    });
    return { reactionId };
  },
});

export const listRecentReactions = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const cutoff = Date.now() - RECENT_WINDOW_MS;
    const recent = await ctx.db
      .query("reactions")
      .withIndex("by_event_sentAt", (q) => q.eq("eventId", eventId).gt("sentAt", cutoff))
      .collect();
    return recent.map((r) => ({
      reactionId: r._id,
      emoji: r.emoji,
      sentAt: r.sentAt,
    }));
  },
});

export const pruneOldReactions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_MS;
    const stale = await ctx.db
      .query("reactions")
      .withIndex("by_sentAt", (q) => q.lt("sentAt", cutoff))
      .take(500);
    await Promise.all(stale.map((r) => ctx.db.delete(r._id)));
  },
});
