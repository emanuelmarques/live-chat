import { ConvexError } from "convex/values";
// Input size limits. Keep in sync with src/lib/limits.ts (used for `maxLength` on the inputs).
export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_DISPLAY_NAME_LENGTH = 40;
export const MAX_EVENT_NAME_LENGTH = 100;
export const MAX_POLL_QUESTION_LENGTH = 200;
export const MAX_POLL_OPTION_LENGTH = 100;
export const MAX_BLOCKLIST_TERM_LENGTH = 100;

export function assertMaxLength(value: string, max: number, label: string) {
  if (value.length > max) {
    throw new ConvexError(`${label} is too long (max ${max} characters).`);
  }
}
