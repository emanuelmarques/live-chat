import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/** Throws unless `sessionToken` names a current, unexpired session; returns the moderator id. */
export async function requireModerator(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
): Promise<Id<"moderators">> {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", sessionToken))
    .first();
  if (session === null || session.expiresAt < Date.now()) {
    throw new Error("Not authenticated.");
  }
  return session.moderatorId;
}
