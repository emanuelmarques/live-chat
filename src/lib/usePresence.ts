import { useEffect, useState } from "react";
import { useMutation, useQuery, api, type Id } from "./convexClient";

const HEARTBEAT_INTERVAL_MS = 60_000;
const COUNT_REFRESH_INTERVAL_MS = 5_000;

/** Tells the server this participant is still in the chat (only while the tab is visible). */
export function useHeartbeat(eventId: Id<"events"> | undefined, participantId: string | undefined) {
  const heartbeat = useMutation(api.participants.heartbeat);

  useEffect(() => {
    if (!eventId || !participantId) return;
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      heartbeat({ eventId, participantId: participantId as Id<"participants"> }).catch(() => {
        // Best effort: the next beat retries.
      });
    };
    beat();
    const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [eventId, participantId, heartbeat]);
}

/** Live count of people seen in the chat in the last 3 minutes. */
export function useActiveParticipantCount(eventId: Id<"events"> | undefined) {
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setRefreshKey((n) => n + 1), COUNT_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
  return useQuery(
    api.participants.countActiveParticipants,
    eventId ? { eventId, refreshKey } : "skip",
  );
}
