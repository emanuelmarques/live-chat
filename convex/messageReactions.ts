import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { QUICK_REACTIONS } from "./reactions";

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
    await ctx.db.insert("messageReactions", {
      eventId: message.eventId,
      messageId,
      participantId,
      emoji,
      createdAt: Date.now(),
    });
    return { active: true };
  },
});
