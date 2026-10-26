import type { ReactionRow } from "./reactions";

// How long after being sent a reaction is still worth animating. Keeps a
// client that just mounted (and received a short backlog from the live
// query's window) from replaying reactions that already finished flying for
// everyone else — it just marks them seen and skips them silently.
export const FLIGHT_FRESH_WINDOW_MS = 4_000;

/**
 * Picks the reactions that should trigger a new flight: not seen before (so
 * each reaction animates exactly once per client, no matter how many times
 * the live query re-delivers it) and recent enough to still feel "live".
 * Mutates `seenIds` as a side effect so the caller doesn't have to.
 */
export function selectFreshReactions(
  reactions: ReactionRow[],
  seenIds: Set<string>,
  now: number,
): ReactionRow[] {
  const fresh: ReactionRow[] = [];
  for (const reaction of reactions) {
    if (seenIds.has(reaction.reactionId)) continue;
    seenIds.add(reaction.reactionId);
    if (now - reaction.sentAt < FLIGHT_FRESH_WINDOW_MS) {
      fresh.push(reaction);
    }
  }
  return fresh;
}
