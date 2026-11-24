import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";

export const modules = import.meta.glob("../../convex/**/*.ts");

export function newTestInstance() {
  return convexTest(schema, modules);
}

const TEST_MODERATOR = { email: "mod@example.com", password: "s3cret-password" };

/** Bootstraps the single v1 moderator and logs in, returning a usable session token. */
export async function createModeratorSession(
  t: ReturnType<typeof newTestInstance>,
): Promise<string> {
  await t.mutation(api.auth.bootstrapModerator, TEST_MODERATOR);
  const result = await t.mutation(api.auth.login, TEST_MODERATOR);
  if (!result.ok) throw new Error("Test moderator login failed.");
  return result.sessionToken;
}

/** The visible chat, oldest first, fetched in one page (`listMessages` is paginated, newest first). */
export async function listVisibleMessages(
  t: ReturnType<typeof newTestInstance>,
  eventId: Id<"events">,
) {
  const result = await t.query(api.messages.listMessages, {
    eventId,
    paginationOpts: { numItems: 100, cursor: null },
  });
  return [...result.page].reverse();
}
