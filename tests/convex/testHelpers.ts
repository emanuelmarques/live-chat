import { convexTest } from "convex-test";
import schema from "../../convex/schema";
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
  const { sessionToken } = await t.mutation(api.auth.login, TEST_MODERATOR);
  return sessionToken;
}
