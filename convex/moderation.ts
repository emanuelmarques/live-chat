import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireModerator } from "./lib/requireModerator";
import { insertMissingDefaultTerms } from "./lib/defaultBlocklist";
import { MAX_BLOCKLIST_TERM_LENGTH, assertMaxLength } from "./lib/limits";

/** Adds the default block-list terms the moderator doesn't already have. */
export const addDefaultBlockList = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const moderatorId = await requireModerator(ctx, sessionToken);
    return { added: await insertMissingDefaultTerms(ctx.db, moderatorId) };
  },
});

/**
 * One-off backfill for deployments created before the defaults existed:
 * `npx convex run moderation:seedDefaultsForExistingModerators` (add `--prod` for production).
 * The block-list is global, so this covers every existing event.
 */
export const seedDefaultsForExistingModerators = internalMutation({
  args: {},
  handler: async (ctx) => {
    const moderators = await ctx.db.query("moderators").collect();
    let added = 0;
    for (const m of moderators) {
      added += await insertMissingDefaultTerms(ctx.db, m._id);
    }
    return { moderators: moderators.length, added };
  },
});

export const listBlockListEntries = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const moderatorId = await requireModerator(ctx, sessionToken);
    const entries = await ctx.db
      .query("blockListEntries")
      .withIndex("by_moderator", (q) => q.eq("moderatorId", moderatorId))
      .collect();
    return entries.map((e) => ({ entryId: e._id, term: e.term, addedAt: e.addedAt }));
  },
});

export const addBlockListEntry = mutation({
  args: { sessionToken: v.string(), term: v.string() },
  handler: async (ctx, { sessionToken, term }) => {
    const moderatorId = await requireModerator(ctx, sessionToken);
    const trimmed = term.trim();
    if (trimmed.length === 0) {
      throw new Error("A non-empty term is required.");
    }
    assertMaxLength(trimmed, MAX_BLOCKLIST_TERM_LENGTH, "The term");
    const entryId = await ctx.db.insert("blockListEntries", {
      moderatorId,
      term: trimmed,
      addedAt: Date.now(),
    });
    return { entryId };
  },
});

export const removeBlockListEntry = mutation({
  args: { sessionToken: v.string(), entryId: v.id("blockListEntries") },
  handler: async (ctx, { sessionToken, entryId }) => {
    await requireModerator(ctx, sessionToken);
    await ctx.db.delete(entryId);
    return {};
  },
});

export const listPending = query({
  args: { sessionToken: v.string(), eventId: v.id("events") },
  handler: async (ctx, { sessionToken, eventId }) => {
    await requireModerator(ctx, sessionToken);
    const pending = await ctx.db
      .query("messages")
      .withIndex("by_event_status", (q) => q.eq("eventId", eventId).eq("moderationStatus", "pending"))
      .collect();
    return pending
      .filter((m) => m.deletedAt === null)
      .map((m) => ({
        messageId: m._id,
        authorDisplayName: m.authorDisplayName,
        content: m.content,
        sentAt: m.sentAt,
      }));
  },
});

export const approveMessage = mutation({
  args: { sessionToken: v.string(), messageId: v.id("messages") },
  handler: async (ctx, { sessionToken, messageId }) => {
    await requireModerator(ctx, sessionToken);
    const message = await ctx.db.get(messageId);
    if (message === null) {
      throw new Error("Message not found.");
    }
    await ctx.db.patch(messageId, { moderationStatus: "visible" });
    return {};
  },
});

export const rejectMessage = mutation({
  args: { sessionToken: v.string(), messageId: v.id("messages") },
  handler: async (ctx, { sessionToken, messageId }) => {
    await requireModerator(ctx, sessionToken);
    const message = await ctx.db.get(messageId);
    if (message === null) {
      throw new Error("Message not found.");
    }
    await ctx.db.patch(messageId, { moderationStatus: "rejected" });
    return {};
  },
});

/** Removes any message from the chat for everyone (not only its author). */
export const deleteMessageAsModerator = mutation({
  args: { sessionToken: v.string(), messageId: v.id("messages") },
  handler: async (ctx, { sessionToken, messageId }) => {
    await requireModerator(ctx, sessionToken);
    const message = await ctx.db.get(messageId);
    if (message === null) {
      throw new Error("Message not found.");
    }
    if (message.deletedAt === null) {
      await ctx.db.patch(messageId, { deletedAt: Date.now() });
    }
    const event = await ctx.db.get(message.eventId);
    if (event?.highlightedMessageId === messageId) {
      await ctx.db.patch(event._id, { highlightedMessageId: null });
    }
    return {};
  },
});

/** Pins a message to the top of the projector. Replaces any previous highlight. */
export const highlightMessage = mutation({
  args: { sessionToken: v.string(), messageId: v.id("messages") },
  handler: async (ctx, { sessionToken, messageId }) => {
    await requireModerator(ctx, sessionToken);
    const message = await ctx.db.get(messageId);
    if (message === null) {
      throw new Error("Message not found.");
    }
    if (message.deletedAt !== null || message.moderationStatus !== "visible") {
      throw new Error("Only a visible message can be highlighted.");
    }
    await ctx.db.patch(message.eventId, { highlightedMessageId: messageId });
    return {};
  },
});

export const clearHighlight = mutation({
  args: { sessionToken: v.string(), eventId: v.id("events") },
  handler: async (ctx, { sessionToken, eventId }) => {
    await requireModerator(ctx, sessionToken);
    await ctx.db.patch(eventId, { highlightedMessageId: null });
    return {};
  },
});
