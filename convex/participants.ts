import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireModerator } from "./lib/requireModerator";

/** Public: how many people have joined the event's chat (shown on the projector). */
export const countParticipants = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();
    return participants.length;
  },
});

/** Moderator-only: everyone who joined the event, most recent first. */
export const listParticipants = query({
  args: { sessionToken: v.string(), eventId: v.id("events") },
  handler: async (ctx, { sessionToken, eventId }) => {
    await requireModerator(ctx, sessionToken);
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .order("desc")
      .collect();
    return participants.map((p) => ({
      participantId: p._id,
      displayName: p.displayName,
      joinedAt: p.joinedAt,
    }));
  },
});

export const joinEvent = mutation({
  args: { eventId: v.id("events"), displayName: v.string() },
  handler: async (ctx, { eventId, displayName }) => {
    const trimmedName = displayName.trim();
    if (trimmedName.length === 0) {
      throw new Error("A display name is required.");
    }
    const event = await ctx.db.get(eventId);
    if (event === null || event.status === "ended") {
      throw new Error("This event has ended.");
    }
    const participantId = await ctx.db.insert("participants", {
      eventId,
      displayName: trimmedName,
      joinedAt: Date.now(),
    });
    return { participantId };
  },
});
