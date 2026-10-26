import { describe, expect, test } from "vitest";
import { FLIGHT_FRESH_WINDOW_MS, selectFreshReactions } from "./reactionFlights";
import type { ReactionRow } from "./reactions";

function reaction(reactionId: string, sentAt: number, emoji = "🎉"): ReactionRow {
  return { reactionId, emoji, sentAt };
}

describe("selectFreshReactions", () => {
  test("includes a brand-new reaction and marks it seen", () => {
    const seen = new Set<string>();
    const now = 10_000;
    const result = selectFreshReactions([reaction("r1", now)], seen, now);
    expect(result.map((r) => r.reactionId)).toEqual(["r1"]);
    expect(seen.has("r1")).toBe(true);
  });

  test("never returns the same reaction id twice", () => {
    const seen = new Set<string>();
    const now = 10_000;
    const reactions = [reaction("r1", now)];
    selectFreshReactions(reactions, seen, now);
    const second = selectFreshReactions(reactions, seen, now + 100);
    expect(second).toEqual([]);
  });

  test("skips a reaction older than the fresh window without re-marking it later", () => {
    const seen = new Set<string>();
    const now = 100_000;
    const stale = reaction("old", now - FLIGHT_FRESH_WINDOW_MS - 1);
    const result = selectFreshReactions([stale], seen, now);
    expect(result).toEqual([]);
    expect(seen.has("old")).toBe(true); // seen so it's never replayed, just never animated
  });

  test("returns multiple simultaneous fresh reactions in order", () => {
    const seen = new Set<string>();
    const now = 5_000;
    const result = selectFreshReactions(
      [reaction("a", now, "👍"), reaction("b", now, "🔥")],
      seen,
      now,
    );
    expect(result.map((r) => r.emoji)).toEqual(["👍", "🔥"]);
  });
});
