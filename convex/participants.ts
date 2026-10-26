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
      kickedAt: p.kickedAt,
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
      kickedAt: null,
    });
    return { participantId };
  },
});

/** Moderator-only: removes a participant from the event — they can no longer post, react, or vote. */
export const kickParticipant = mutation({
  args: { sessionToken: v.string(), participantId: v.id("participants") },
  handler: async (ctx, { sessionToken, participantId }) => {
    await requireModerator(ctx, sessionToken);
    const participant = await ctx.db.get(participantId);
    if (participant === null) {
      throw new Error("Participant not found.");
    }
    if (!participant.kickedAt) {
      await ctx.db.patch(participantId, { kickedAt: Date.now() });
    }
    return {};
  },
});

/** Public: lets a participant's own client detect it has been kicked, so it can stop posting. */
export const getParticipantStatus = query({
  args: { eventId: v.id("events"), participantId: v.id("participants") },
  handler: async (ctx, { eventId, participantId }) => {
    const participant = await ctx.db.get(participantId);
    if (participant === null || participant.eventId !== eventId) {
      return null;
    }
    return { kicked: Boolean(participant.kickedAt) };
  },
});
