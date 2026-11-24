import { useCallback, useMemo } from "react";
import { usePaginatedQuery } from "convex/react";
import { api, type Id } from "./convexClient";

/** How many messages are loaded at first, and each time the reader scrolls up for older ones. */
export const MESSAGES_PAGE_SIZE = 50;

/**
 * The visible chat, oldest first, loaded a page at a time: the newest
 * `MESSAGES_PAGE_SIZE` messages up front, older ones on demand via `loadMore`.
 * `messages` is undefined until the first page arrives (or while skipped).
 */
export function usePagedMessages(eventId: Id<"events"> | undefined) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.listMessages,
    eventId ? { eventId } : "skip",
    { initialNumItems: MESSAGES_PAGE_SIZE },
  );
  const messages = useMemo(
    () => (status === "LoadingFirstPage" ? undefined : [...results].reverse()),
    [results, status],
  );
  const loadOlder = useCallback(() => loadMore(MESSAGES_PAGE_SIZE), [loadMore]);
  return { messages, status, loadOlder };
}
