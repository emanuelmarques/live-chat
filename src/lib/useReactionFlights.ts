import { useEffect, useRef, useState } from "react";
import type { ReactionRow } from "./reactions";
import { selectFreshReactions } from "./reactionFlights";

export interface Flight {
  key: string;
  emoji: string;
  /** Horizontal start position, 0-100 (% of the overlay's width). */
  left: number;
  /** Small random horizontal drift in px, applied via a CSS custom property. */
  drift: number;
  /** Small random end rotation in degrees, for a less mechanical flight path. */
  rotate: number;
  durationMs: number;
}

const FLIGHT_DURATION_MS = 2600;
const FLIGHT_DURATION_JITTER_MS = 600;

/**
 * Turns a live `listRecentReactions` result into one-shot flight animations:
 * each reaction id spawns exactly one flight, which removes itself after its
 * duration. Re-renders of `reactions` (new reactions arriving) never cancel
 * flights already in progress — only unmounting does.
 */
export function useReactionFlights(reactions: ReactionRow[]): Flight[] {
  const [flights, setFlights] = useState<Flight[]>([]);
  const seenIds = useRef(new Set<string>());
  const timerIds = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const fresh = selectFreshReactions(reactions, seenIds.current, Date.now());
    if (fresh.length === 0) return;

    const spawned: Flight[] = fresh.map((reaction) => ({
      key: reaction.reactionId,
      emoji: reaction.emoji,
      left: 10 + Math.random() * 80,
      drift: Math.random() * 60 - 30,
      rotate: Math.random() * 30 - 15,
      durationMs: FLIGHT_DURATION_MS + Math.random() * FLIGHT_DURATION_JITTER_MS,
    }));

    setFlights((current) => [...current, ...spawned]);

    for (const flight of spawned) {
      const timerId = setTimeout(() => {
        timerIds.current.delete(timerId);
        setFlights((current) => current.filter((f) => f.key !== flight.key));
      }, flight.durationMs + 200);
      timerIds.current.add(timerId);
    }
  }, [reactions]);

  useEffect(() => {
    const timers = timerIds.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  return flights;
}
