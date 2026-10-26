import type { CSSProperties } from "react";
import type { Flight } from "../lib/useReactionFlights";

interface FlyingReactionsProps {
  flights: Flight[];
}

/**
 * A full-surface overlay of emoji rising and fading out, Zoom-style.
 * Purely decorative (aria-hidden) — the reactions themselves carry no
 * information that isn't supplementary to the chat.
 */
export function FlyingReactions({ flights }: FlyingReactionsProps) {
  if (flights.length === 0) return null;

  return (
    <div className="reaction-overlay" aria-hidden="true">
      {flights.map((flight) => (
        <span
          key={flight.key}
          className="reaction-fly"
          style={
            {
              left: `${flight.left}%`,
              "--reaction-drift": `${flight.drift}px`,
              "--reaction-rotate": `${flight.rotate}deg`,
              animationDuration: `${flight.durationMs}ms`,
            } as CSSProperties
          }
        >
          {flight.emoji}
        </span>
      ))}
    </div>
  );
}
