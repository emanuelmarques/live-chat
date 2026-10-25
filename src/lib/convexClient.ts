import { ConvexReactClient } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is not set — run `npx convex dev` to generate .env.local.");
}

export const convexClient = new ConvexReactClient(convexUrl);

// Re-exported so feature code imports hooks, `api`, and `Id` from one place.
export { useQuery, useMutation } from "convex/react";
export { api } from "../../convex/_generated/api";
export type { Id } from "../../convex/_generated/dataModel";
