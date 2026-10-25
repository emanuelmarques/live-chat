const STORAGE_PREFIX = "liveChat.participant.";

export interface StoredParticipant {
  participantId: string;
  displayName: string;
}

export function participantStorageKey(joinSlug: string): string {
  return STORAGE_PREFIX + joinSlug;
}

export function getStoredParticipant(joinSlug: string): StoredParticipant | null {
  try {
    const raw = localStorage.getItem(participantStorageKey(joinSlug));
    return raw ? (JSON.parse(raw) as StoredParticipant) : null;
  } catch {
    return null;
  }
}

export function storeParticipant(joinSlug: string, participant: StoredParticipant): void {
  try {
    localStorage.setItem(participantStorageKey(joinSlug), JSON.stringify(participant));
  } catch {
    // Storage unavailable — the participant simply re-enters their name if they reload.
  }
}

/**
 * Joins at most once per browser per event, even if several tabs race to join
 * at the same time (e.g. two tabs opened from the same QR code). If this
 * browser has already joined, returns the existing participant without
 * calling `performJoin` again. Otherwise, uses the Web Locks API — when
 * available — so only one tab across the whole browser can be mid-join at a
 * time; every other racing tab waits, then picks up the result that tab
 * already stored instead of joining a second time.
 *
 * Without Web Locks (older browsers), this falls back to a plain check — a
 * narrow race is possible there, but it's a graceful degradation, not a
 * silent failure.
 */
export async function joinOncePerBrowser(
  joinSlug: string,
  performJoin: () => Promise<StoredParticipant>,
): Promise<StoredParticipant> {
  const existing = getStoredParticipant(joinSlug);
  if (existing) return existing;

  if (typeof navigator === "undefined" || !("locks" in navigator)) {
    const participant = await performJoin();
    storeParticipant(joinSlug, participant);
    return participant;
  }

  return navigator.locks.request(`live-chat-join:${joinSlug}`, async () => {
    // Re-check inside the lock: another tab may have finished joining while
    // this tab was waiting for the lock.
    const stillExisting = getStoredParticipant(joinSlug);
    if (stillExisting) return stillExisting;
    const participant = await performJoin();
    storeParticipant(joinSlug, participant);
    return participant;
  });
}
