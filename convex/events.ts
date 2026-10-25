import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireModerator } from "./lib/requireModerator";

function generateJoinSlug(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

export const createEvent = mutation({
  args: { sessionToken: v.string(), name: v.string() },
  handler: async (ctx, { sessionToken, name }) => {
    await requireModerator(ctx, sessionToken);
    const joinSlug = generateJoinSlug();
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
    const event = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("joinSlug", joinSlug))
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
