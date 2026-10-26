// Fixed, curated set — mirrors Zoom-style reactions rather than a free-form
// emoji picker, so the flying overlay stays a small, recognizable vocabulary.
// Keep in sync with QUICK_REACTIONS in convex/reactions.ts.
export const QUICK_REACTIONS = ["👍", "❤️", "🎉", "😂", "👏", "😮", "🔥", "💯"] as const;

export type QuickReaction = (typeof QUICK_REACTIONS)[number];

export interface ReactionRow {
  reactionId: string;
  emoji: string;
  sentAt: number;
}
