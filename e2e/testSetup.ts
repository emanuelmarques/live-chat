import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const TEST_MODERATOR = { email: "e2e-mod@example.com", password: "e2e-test-password" };

export function newConvexClient(): ConvexHttpClient {
  const url = process.env.VITE_CONVEX_URL;
  if (!url) {
    throw new Error("VITE_CONVEX_URL is not set — run `npx convex dev` at least once first.");
  }
  return new ConvexHttpClient(url);
}

/** Bootstraps (if needed) and logs in as the single test moderator account. */
export async function getModeratorSessionToken(client: ConvexHttpClient): Promise<string> {
  try {
    await client.mutation(api.auth.bootstrapModerator, TEST_MODERATOR);
  } catch {
    // Already bootstrapped by an earlier test run — that's fine.
  }
  const { sessionToken } = await client.mutation(api.auth.login, TEST_MODERATOR);
  return sessionToken;
}

export async function createTestEvent(client: ConvexHttpClient, name: string) {
  const sessionToken = await getModeratorSessionToken(client);
  return client.mutation(api.events.createEvent, { sessionToken, name });
}
