import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  events: defineTable({
    name: v.string(),
    status: v.union(v.literal("active"), v.literal("ended")),
    joinSlug: v.string(),
    createdAt: v.number(),
    endedAt: v.union(v.number(), v.null()),
    activePollId: v.union(v.id("polls"), v.null()),
  }).index("by_slug", ["joinSlug"]),

  moderators: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    moderatorId: v.id("moderators"),
    token: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  participants: defineTable({
    eventId: v.id("events"),
    displayName: v.string(),
    joinedAt: v.number(),
  }).index("by_event", ["eventId"]),

  messages: defineTable({
    eventId: v.id("events"),
    participantId: v.id("participants"),
    authorDisplayName: v.string(),
    content: v.string(),
    replyToMessageId: v.union(v.id("messages"), v.null()),
    sentAt: v.number(),
    moderationStatus: v.union(
      v.literal("visible"),
      v.literal("pending"),
      v.literal("rejected"),
    ),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index("by_event_sentAt", ["eventId", "sentAt"])
    .index("by_event_status", ["eventId", "moderationStatus"])
    .index("by_participant", ["participantId"]),

  polls: defineTable({
    eventId: v.id("events"),
    question: v.string(),
    options: v.array(v.string()),
    revealMode: v.union(v.literal("live"), v.literal("atEnd")),
    status: v.union(v.literal("active"), v.literal("ended")),
    resultsRevealed: v.boolean(),
    startedAt: v.number(),
    endedAt: v.union(v.number(), v.null()),
  }).index("by_event", ["eventId"]),

  pollVotes: defineTable({
    pollId: v.id("polls"),
    participantId: v.id("participants"),
    optionIndex: v.number(),
    votedAt: v.number(),
  }).index("by_poll_participant", ["pollId", "participantId"]),

  blockListEntries: defineTable({
    moderatorId: v.id("moderators"),
    term: v.string(),
    addedAt: v.number(),
  }).index("by_moderator", ["moderatorId"]),

  // Ephemeral Zoom-style flying reactions — not part of the chat transcript,
  // so they're pruned shortly after they're sent (see crons.ts) rather than
  // retained for the life of the event.
  reactions: defineTable({
    eventId: v.id("events"),
    participantId: v.id("participants"),
    emoji: v.string(),
    sentAt: v.number(),
  })
    .index("by_event_sentAt", ["eventId", "sentAt"])
    .index("by_sentAt", ["sentAt"])
    .index("by_participant", ["participantId"]),
});
