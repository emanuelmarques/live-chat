import { useMemo, useRef } from "react";
import { useQuery, api, type Id } from "./convexClient";

export interface ReactionCount {
  emoji: string;
  count: number;
}
export type ReactionsByMessage = Record<string, ReactionCount[]>;

/** Key identifying "this participant reacted to this message with this emoji". */
export function reactionKey(messageId: string, emoji: string): string {
  return `${messageId}\u0000${emoji}`;
}

// The newest page slides as messages arrive, so `since` is rounded down: otherwise
// every new message would re-subscribe every client to a new reactions query.
const SINCE_BUCKET_MS = 5 * 60 * 1000;

/**
 * Reaction counts for the loaded messages (and, when `participantId` is given,
 * which of them are the viewer's own). `oldestSentAt` is the sentAt of the oldest
 * loaded message.
 */
export function useMessageReactions(
  eventId: Id<"events"> | undefined,
  oldestSentAt: number | undefined,
  participantId?: Id<"participants">,
) {
  const counts = useQuery(
    api.messageReactions.listMessageReactions,
    eventId && oldestSentAt !== undefined
      ? { eventId, since: Math.floor(oldestSentAt / SINCE_BUCKET_MS) * SINCE_BUCKET_MS }
      : "skip",
  );
  // Re-subscribing (older messages loaded) briefly yields `undefined`; keep showing the last counts.
  const lastCounts = useRef<ReactionsByMessage>({});
  if (counts !== undefined) lastCounts.current = counts;

  const mine = useQuery(
    api.messageReactions.listMyMessageReactions,
    eventId && participantId ? { eventId, participantId } : "skip",
  );
  const lastMine = useRef<ReadonlySet<string>>(new Set());
  const mineSet = useMemo(() => {
    if (mine === undefined) return lastMine.current;
    return (lastMine.current = new Set(mine.map((r) => reactionKey(r.messageId, r.emoji))));
  }, [mine]);

  return { reactions: lastCounts.current, myReactions: mineSet };
}
