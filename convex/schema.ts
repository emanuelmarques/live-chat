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
    // Message pinned to the top of the projector as a discussion topic.
    // Optional: events created before this field existed have none.
    highlightedMessageId: v.optional(v.union(v.id("messages"), v.null())),
  }).index("by_slug", ["joinSlug"]),

  moderators: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  // Failed moderator logins, for the lockout in auth.ts. Cleared on success.
  loginAttempts: defineTable({
    key: v.string(),
    failedAt: v.number(),
  }).index("by_key_failedAt", ["key", "failedAt"]),

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
    // Optional: participants that joined before this field existed have no
    // `kickedAt` at all. `undefined` and `null` both mean "not kicked".
    kickedAt: v.optional(v.union(v.number(), v.null())),
    // Opaque public identity shown to other clients instead of `_id` (which is
    // the participant's credential). Optional for rows that predate it.
    publicKey: v.optional(v.string()),
  }).index("by_event", ["eventId"]),

  // Who is actually in the chat right now: one row per participant, refreshed by
  // a client heartbeat. Kept apart from `participants` so heartbeats don't
  // invalidate the participant list queries.
  presence: defineTable({
    eventId: v.id("events"),
    participantId: v.id("participants"),
    lastSeenAt: v.number(),
  })
    .index("by_participant", ["participantId"])
    .index("by_event_lastSeenAt", ["eventId", "lastSeenAt"]),

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
    // Denormalized public identity of the author (see lib/authorKey.ts), so listMessages
    // needn't read every participant on each re-run.
    authorKey: v.optional(v.string()),
  })
    .index("by_event_sentAt", ["eventId", "sentAt"])
    .index("by_event_status", ["eventId", "moderationStatus"])
    .index("by_participant", ["participantId"]),

  polls: defineTable({
    eventId: v.id("events"),
    question: v.string(),
    options: v.array(v.string()),
    revealMode: v.union(v.literal("live"), v.literal("atEnd")),
    // "draft" = prepared in advance, not visible to participants until activated.
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("ended")),
    resultsRevealed: v.boolean(),
    // `null` while the poll is still a draft.
    startedAt: v.union(v.number(), v.null()),
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

  // Persistent reactions attached to a chat message (one row per participant +
  // message + emoji; toggling again removes it). Same emoji set as the flying
  // reactions below.
  messageReactions: defineTable({
    eventId: v.id("events"),
    messageId: v.id("messages"),
    participantId: v.id("participants"),
    emoji: v.string(),
    createdAt: v.number(),
    // Unused since reactions became aggregate counts; kept optional for old rows.
    authorKey: v.optional(v.string()),
    // sentAt of the reacted message (denormalized) so a client can ask for the
    // reactions of just the messages it has loaded. Optional for old rows (see
    // `backfillMessageSentAt`).
    messageSentAt: v.optional(v.number()),
  })
    .index("by_event", ["eventId"])
    .index("by_event_messageSentAt", ["eventId", "messageSentAt"])
    .index("by_message_participant_emoji", ["messageId", "participantId", "emoji"])
    .index("by_participant", ["participantId"]),

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
