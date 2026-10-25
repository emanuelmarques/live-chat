const STORAGE_PREFIX = "liveChat.participant.";

export interface StoredParticipant {
  participantId: string;
  displayName: string;
}

export function getStoredParticipant(joinSlug: string): StoredParticipant | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + joinSlug);
    return raw ? (JSON.parse(raw) as StoredParticipant) : null;
  } catch {
    return null;
  }
}

export function storeParticipant(joinSlug: string, participant: StoredParticipant): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + joinSlug, JSON.stringify(participant));
  } catch {
    // Storage unavailable — the participant simply re-enters their name if they reload.
  }
}
