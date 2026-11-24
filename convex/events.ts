import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id, TableNames } from "./_generated/dataModel";
import { requireModerator } from "./lib/requireModerator";
import { MAX_EVENT_NAME_LENGTH, assertMaxLength } from "./lib/limits";

// Uppercase letters and digits, minus the pairs people most often misread
// (I/1/L, O/0) — chosen so the code can be read aloud or typed by hand as a
// fallback when a QR code can't be scanned.
const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 6;

function randomJoinCode(): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

async function generateUniqueJoinSlug(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomJoinCode();
    const existing = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("joinSlug", candidate))
      .first();
    if (existing === null) {
      return candidate;
    }
  }
  throw new Error("Could not generate a unique join code — please try again.");
}

export const createEvent = mutation({
  args: { sessionToken: v.string(), name: v.string() },
  handler: async (ctx, { sessionToken, name }) => {
    await requireModerator(ctx, sessionToken);
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      throw new Error("An event needs a name.");
    }
    assertMaxLength(trimmedName, MAX_EVENT_NAME_LENGTH, "The event name");
    const joinSlug = await generateUniqueJoinSlug(ctx);
    const eventId = await ctx.db.insert("events", {
      name: trimmedName,
      status: "active",
      joinSlug,
      createdAt: Date.now(),
      endedAt: null,
      activePollId: null,
    });
    return { eventId, joinSlug };
  },
});

export const getJoinInfo = query({
  args: { joinSlug: v.string() },
  handler: async (ctx, { joinSlug }) => {
    // Codes are generated uppercase-only; normalize so a code typed by hand
    // (any case, stray whitespace) still resolves.
    const normalized = joinSlug.trim().toUpperCase();
    const event = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("joinSlug", normalized))
      .first();
    if (event === null) {
      return null;
    }
    return { eventId: event._id, name: event.name, status: event.status };
  },
});

export const getEvent = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (event === null) {
      return null;
    }
    return {
      name: event.name,
      status: event.status,
      joinSlug: event.joinSlug,
      activePollId: event.activePollId,
      createdAt: event.createdAt,
      endedAt: event.endedAt,
    };
  },
});

export const listEvents = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireModerator(ctx, sessionToken);
    const events = await ctx.db.query("events").order("desc").collect();
    return events.map((event) => ({
      eventId: event._id,
      name: event.name,
      status: event.status,
      joinSlug: event.joinSlug,
      createdAt: event.createdAt,
      endedAt: event.endedAt,
    }));
  },
});

export const endEvent = mutation({
  args: { sessionToken: v.string(), eventId: v.id("events") },
  handler: async (ctx, { sessionToken, eventId }) => {
    await requireModerator(ctx, sessionToken);
    const event = await ctx.db.get(eventId);
    if (event === null) {
      throw new Error("Event not found.");
    }
    if (event.status === "ended") {
      return {};
    }
    const now = Date.now();
    // A poll can't outlive its event: close it so nobody sees "poll in progress".
    if (event.activePollId !== null) {
      await ctx.db.patch(event.activePollId, { status: "ended", endedAt: now });
    }
    await ctx.db.patch(eventId, { status: "ended", endedAt: now, activePollId: null });
    return {};
  },
});

/**
 * Permanently deletes an ended event and everything that belongs to it. Only
 * ended events can be deleted — a live event must be ended first.
 *
 * The event row goes immediately (so it vanishes from every list and its join
 * link stops resolving); its messages, polls, participants etc. are purged in
 * batches by `purgeEventData`, since one mutation can't write unboundedly.
 */
export const deleteEvent = mutation({
  args: { sessionToken: v.string(), eventId: v.id("events") },
  handler: async (ctx, { sessionToken, eventId }) => {
    await requireModerator(ctx, sessionToken);
    const event = await ctx.db.get(eventId);
    if (event === null) {
      return {}; // already deleted (double click / stale tab)
    }
    if (event.status !== "ended") {
      throw new Error("End the event before deleting it.");
    }
    await ctx.db.delete(eventId);
    await ctx.scheduler.runAfter(0, internal.events.purgeEventData, { eventId });
    return {};
  },
});

const PURGE_BATCH = 300;

export const purgeEventData = internalMutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    let more = false;
    const sweep = async (rows: { _id: Id<TableNames> }[]) => {
      await Promise.all(rows.map((r) => ctx.db.delete(r._id)));
      if (rows.length === PURGE_BATCH) more = true;
    };

    const polls = await ctx.db
      .query("polls")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .take(20);
    for (const poll of polls) {
      const votes = await ctx.db
        .query("pollVotes")
        .withIndex("by_poll_participant", (q) => q.eq("pollId", poll._id))
        .take(PURGE_BATCH);
      await sweep(votes);
      if (votes.length < PURGE_BATCH) {
        await ctx.db.delete(poll._id);
      }
    }
    if (polls.length === 20) more = true;

    await sweep(
      await ctx.db
        .query("messageReactions")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .take(PURGE_BATCH),
    );
    await sweep(
      await ctx.db
        .query("reactions")
        .withIndex("by_event_sentAt", (q) => q.eq("eventId", eventId))
        .take(PURGE_BATCH),
    );
    await sweep(
      await ctx.db
        .query("presence")
        .withIndex("by_event_lastSeenAt", (q) => q.eq("eventId", eventId))
        .take(PURGE_BATCH),
    );
    await sweep(
      await ctx.db
        .query("messages")
        .withIndex("by_event_sentAt", (q) => q.eq("eventId", eventId))
        .take(PURGE_BATCH),
    );
    await sweep(
      await ctx.db
        .query("participants")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .take(PURGE_BATCH),
    );

    if (more) {
      await ctx.scheduler.runAfter(0, internal.events.purgeEventData, { eventId });
    }
  },
});
