import type { Doc } from "../_generated/dataModel";

/**
 * Public, opaque identity of a participant, safe to send to every client.
 *
 * A participant's `_id` is their *credential* (mutations such as sendMessage /
 * deleteMessage / castVote authenticate with it), so it must never leave the
 * server except to its owner. Anything shown to other clients (message
 * authorship, "who reacted") uses this key instead.
 * Rows created before `publicKey` existed fall back to their creation time,
 * which is public information and not a credential.
 */
export function authorKey(participant: Doc<"participants">): string {
  return participant.publicKey ?? `legacy-${participant._creationTime}`;
}
