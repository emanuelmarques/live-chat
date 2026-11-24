import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { QUICK_REACTIONS } from "./reactions";

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_ADDS = 20;

/**
 * Toggles a participant's reaction on a message: adds it if absent, removes it
 * if the participant already reacted with that emoji.
 */
export const toggleMessageReaction = mutation({
  args: {
    messageId: v.id("messages"),
    participantId: v.id("participants"),
    emoji: v.string(),
  },
  handler: async (ctx, { messageId, participantId, emoji }) => {
    if (!(QUICK_REACTIONS as readonly string[]).includes(emoji)) {
      throw new Error("Unsupported reaction emoji.");
    }
    const message = await ctx.db.get(messageId);
    if (message === null || message.deletedAt !== null || message.moderationStatus !== "visible") {
      throw new Error("Message not found.");
    }
    const event = await ctx.db.get(message.eventId);
    if (event === null || event.status === "ended") {
      throw new Error("This event has ended.");
    }
    const participant = await ctx.db.get(participantId);
    if (participant === null || participant.eventId !== message.eventId) {
      throw new Error("Participant not found for this event.");
    }
    if (participant.kickedAt) {
      throw new Error("Kicked: you've been removed from this event by the moderator.");
    }

    const existing = await ctx.db
      .query("messageReactions")
      .withIndex("by_message_participant_emoji", (q) =>
        q.eq("messageId", messageId).eq("participantId", participantId).eq("emoji", emoji),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { active: false };
    }
    // Every toggle re-runs `listMessageReactions` for every connected client, so
    // cap how fast one participant can add reactions (removing one is always allowed).
    const recent = await ctx.db
      .query("messageReactions")
      .withIndex("by_participant", (q) => q.eq("participantId", participantId))
      .order("desc")
      .take(RATE_LIMIT_MAX_ADDS);
    const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;
    if (recent.filter((r) => r.createdAt >= windowStart).length >= RATE_LIMIT_MAX_ADDS) {
      throw new Error("RateLimited: you're reacting too quickly. Please wait a moment.");
    }
    await ctx.db.insert("messageReactions", {
      eventId: message.eventId,
      messageId,
      participantId,
      emoji,
      createdAt: Date.now(),
      messageSentAt: message.sentAt,
    });
    return { active: true };
  },
});

/**
 * Reaction counts for the messages sent at or after `since` (a client passes the
 * sentAt of the oldest message it has loaded), as `messageId -> [{emoji, count}]`.
 * Counts only: who reacted is never sent, and a reaction re-sends only this small
 * result — not the message texts.
 */
export const listMessageReactions = query({
  args: { eventId: v.id("events"), since: v.number() },
  handler: async (ctx, { eventId, since }) => {
    const rows = await ctx.db
      .query("messageReactions")
      .withIndex("by_event_messageSentAt", (q) => q.eq("eventId", eventId).gte("messageSentAt", since))
      .collect();
    const byMessage = new Map<string, { emoji: string; count: number }[]>();
    for (const r of rows) {
      const list = byMessage.get(r.messageId) ?? [];
      const entry = list.find((e) => e.emoji === r.emoji);
      if (entry) entry.count++;
      else list.push({ emoji: r.emoji, count: 1 });
      byMessage.set(r.messageId, list);
    }
    return Object.fromEntries(byMessage);
  },
});

/**
 * The reactions this participant has given (to highlight their own chips). It
 * only changes when *they* react, so other people's reactions don't re-send it.
 */
export const listMyMessageReactions = query({
  args: { eventId: v.id("events"), participantId: v.id("participants") },
  handler: async (ctx, { eventId, participantId }) => {
    const rows = await ctx.db
      .query("messageReactions")
      .withIndex("by_participant", (q) => q.eq("participantId", participantId))
      .collect();
    return rows
      .filter((r) => r.eventId === eventId)
      .map((r) => ({ messageId: r.messageId, emoji: r.emoji }));
  },
});

/**
 * One-off maintenance: fills `messageSentAt` on reactions created before that
 * field existed, so they show up in `listMessageReactions`. Run once with
 * `npx convex run messageReactions:backfillMessageSentAt` (idempotent).
 */
export const backfillMessageSentAt = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("messageReactions").collect();
    let updated = 0;
    for (const r of rows) {
      if (r.messageSentAt !== undefined) continue;
      const message = await ctx.db.get(r.messageId);
      if (message === null) continue;
      await ctx.db.patch(r._id, { messageSentAt: message.sentAt });
      updated++;
    }
    return { updated };
  },
});
