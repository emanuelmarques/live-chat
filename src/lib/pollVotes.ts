const STORAGE_KEY = "liveChat.votedPollIds";

function readVotedIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function hasVotedInPoll(pollId: string): boolean {
  return readVotedIds().includes(pollId);
}

export function markPollVoted(pollId: string): void {
  try {
    const ids = readVotedIds();
    if (!ids.includes(pollId)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids, pollId]));
    }
  } catch {
    // Storage unavailable — worst case, a vote attempt fails server-side instead.
  }
}
