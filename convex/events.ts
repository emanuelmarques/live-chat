import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireModerator } from "./lib/requireModerator";

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
    const joinSlug = await generateUniqueJoinSlug(ctx);
    const eventId = await ctx.db.insert("events", {
      name,
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
    await ctx.db.patch(eventId, { status: "ended", endedAt: Date.now() });
    return {};
  },
});
