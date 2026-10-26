import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { matchesAnyTerm } from "./lib/blocklist";

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_MESSAGES = 5;

async function assertUnderRateLimit(ctx: MutationCtx, participantId: Id<"participants">) {
  const recent = await ctx.db
    .query("messages")
    .withIndex("by_participant", (q) => q.eq("participantId", participantId))
    .order("desc")
    .take(RATE_LIMIT_MAX_MESSAGES);
  const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;
  const withinWindow = recent.filter((m) => m.sentAt >= windowStart).length;
  if (withinWindow >= RATE_LIMIT_MAX_MESSAGES) {
    throw new Error(
      "RateLimited: you're sending messages too quickly. Please wait a moment.",
    );
  }
}

export const sendMessage = mutation({
  args: {
    eventId: v.id("events"),
    participantId: v.id("participants"),
    content: v.string(),
    replyToMessageId: v.optional(v.id("messages")),
  },
  handler: async (ctx, { eventId, participantId, content, replyToMessageId }) => {
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      throw new Error("Message content is required.");
    }
    const event = await ctx.db.get(eventId);
    if (event === null || event.status === "ended") {
      throw new Error("This event has ended.");
    }
    const participant = await ctx.db.get(participantId);
    if (participant === null || participant.eventId !== eventId) {
      throw new Error("Participant not found for this event.");
    }
    if (participant.kickedAt) {
      throw new Error("Kicked: you've been removed from this event by the moderator.");
    }
    await assertUnderRateLimit(ctx, participantId);

    const blockListEntries = await ctx.db.query("blockListEntries").collect();
    const isBlocked = matchesAnyTerm(trimmed, blockListEntries.map((e) => e.term));

    const messageId = await ctx.db.insert("messages", {
      eventId,
      participantId,
      authorDisplayName: participant.displayName,
      content: trimmed,
      replyToMessageId: replyToMessageId ?? null,
      sentAt: Date.now(),
      // A block-list match holds the message for the moderator (FR-010/FR-011);
      // this check only ever routes to "pending," never directly to "rejected"
      // (constitution Principle V — only a moderator mutation can reject).
      moderationStatus: isBlocked ? "pending" : "visible",
      deletedAt: null,
    });
    return { messageId };
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("messages"), participantId: v.id("participants") },
  handler: async (ctx, { messageId, participantId }) => {
    const message = await ctx.db.get(messageId);
    if (message === null) {
      throw new Error("Message not found.");
    }
    if (message.participantId !== participantId) {
      throw new Error("Only the original author can delete this message.");
    }
    if (message.deletedAt !== null) {
      return {};
    }
    await ctx.db.patch(messageId, { deletedAt: Date.now() });
    return {};
  },
});

export const listMessages = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const all = await ctx.db
      .query("messages")
      .withIndex("by_event_sentAt", (q) => q.eq("eventId", eventId))
      .collect();

    const byId = new Map(all.map((m) => [m._id, m]));

    return all
      .filter((m) => m.moderationStatus === "visible" && m.deletedAt === null)
      .map((m) => {
        let replyTo: {
          messageId: string;
          deleted: boolean;
          authorDisplayName?: string;
          content?: string;
        } | null = null;

        if (m.replyToMessageId !== null) {
          const original = byId.get(m.replyToMessageId);
          const originalIsVisible =
            original !== undefined &&
            original.deletedAt === null &&
            original.moderationStatus === "visible";
          replyTo = originalIsVisible
            ? {
                messageId: original._id,
                deleted: false,
                authorDisplayName: original.authorDisplayName,
                content: original.content,
              }
            : { messageId: m.replyToMessageId, deleted: true };
        }

        return {
          messageId: m._id,
          participantId: m.participantId,
          authorDisplayName: m.authorDisplayName,
          content: m.content,
          replyTo,
          sentAt: m.sentAt,
        };
      });
  },
});

/**
 * A participant's own non-visible messages (pending/rejected), so their own
 * client can render "awaiting approval" / "not approved" — nobody else can see
 * these (FR-012).
 */
export const listOwnPendingOrRejected = query({
  args: { eventId: v.id("events"), participantId: v.id("participants") },
  handler: async (ctx, { eventId, participantId }) => {
    const own = await ctx.db
      .query("messages")
      .withIndex("by_participant", (q) => q.eq("participantId", participantId))
      .collect();
    return own
      .filter(
        (m) =>
          m.eventId === eventId &&
          m.deletedAt === null &&
          (m.moderationStatus === "pending" || m.moderationStatus === "rejected"),
      )
      .map((m) => ({
        messageId: m._id,
        content: m.content,
        moderationStatus: m.moderationStatus,
        sentAt: m.sentAt,
      }));
  },
});
