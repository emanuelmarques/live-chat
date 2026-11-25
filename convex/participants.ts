import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { requireModerator } from "./lib/requireModerator";
import { MAX_DISPLAY_NAME_LENGTH, assertMaxLength } from "./lib/limits";
import { authorKey } from "./lib/authorKey";

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

/** A participant counts as "in the chat" if seen within this window. */
const PRESENCE_WINDOW_MS = 3 * 60 * 1000;

/**
 * Public: how many people are actually in the chat — those seen (joined or
 * heartbeat) in the last 3 minutes. `refreshKey` is ignored by the handler; the
 * client bumps it periodically so the query re-runs and the window slides even
 * when nobody writes (Convex freezes Date.now() per execution).
 */
export const countActiveParticipants = query({
  args: { eventId: v.id("events"), refreshKey: v.optional(v.number()) },
  handler: async (ctx, { eventId }) => {
    const since = Date.now() - PRESENCE_WINDOW_MS;
    const active = await ctx.db
      .query("presence")
      .withIndex("by_event_lastSeenAt", (q) => q.eq("eventId", eventId).gte("lastSeenAt", since))
      .collect();
    return active.length;
  },
});

/** Public: a participant's client reports it is still in the chat. */
export const heartbeat = mutation({
  args: { eventId: v.id("events"), participantId: v.id("participants") },
  handler: async (ctx, { eventId, participantId }) => {
    const participant = await ctx.db.get(participantId);
    if (participant === null || participant.eventId !== eventId || participant.kickedAt) {
      return {};
    }
    await upsertPresence(ctx, eventId, participantId);
    return {};
  },
});

async function upsertPresence(
  ctx: MutationCtx,
  eventId: Id<"events">,
  participantId: Id<"participants">,
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("presence")
    .withIndex("by_participant", (q) => q.eq("participantId", participantId))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { lastSeenAt: now });
  } else {
    await ctx.db.insert("presence", { eventId, participantId, lastSeenAt: now });
  }
}

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
    assertMaxLength(trimmedName, MAX_DISPLAY_NAME_LENGTH, "Your name");
    const event = await ctx.db.get(eventId);
    if (event === null || event.status === "ended") {
      throw new Error("This event has ended.");
    }
    const participantId = await ctx.db.insert("participants", {
      eventId,
      displayName: trimmedName,
      joinedAt: Date.now(),
      kickedAt: null,
      publicKey: crypto.randomUUID(),
    });
    await upsertPresence(ctx, eventId, participantId);
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
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_participant", (q) => q.eq("participantId", participantId))
      .unique();
    if (presence) await ctx.db.delete(presence._id);
    return {};
  },
});

/**
 * Moderator-only: lets a removed participant back in. Their existing identity is
 * kept, so their old messages stay theirs and they can post, react and vote again
 * (their client notices through `getParticipantStatus` and resumes by itself).
 */
export const unkickParticipant = mutation({
  args: { sessionToken: v.string(), participantId: v.id("participants") },
  handler: async (ctx, { sessionToken, participantId }) => {
    await requireModerator(ctx, sessionToken);
    const participant = await ctx.db.get(participantId);
    if (participant === null) {
      throw new ConvexError("Participant not found.");
    }
    if (participant.kickedAt) {
      await ctx.db.patch(participantId, { kickedAt: null });
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
    return { kicked: Boolean(participant.kickedAt), authorKey: authorKey(participant) };
  },
});
