import type { Ref } from "react";

interface LoadOlderMessagesProps {
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  onLoad: () => void;
  /** Observed by `useChatScroll`: reaching it loads the next page automatically. */
  sentinelRef: Ref<HTMLDivElement>;
}

/** Top of the message list: loads older messages on scroll, with a button as a fallback. */
export function LoadOlderMessages({ status, onLoad, sentinelRef }: LoadOlderMessagesProps) {
  if (status !== "CanLoadMore" && status !== "LoadingMore") return null;
  return (
    <div ref={sentinelRef} className="chat__older">
      {status === "LoadingMore" ? (
        <span role="status">Loading earlier messages…</span>
      ) : (
        <button type="button" onClick={onLoad}>
          Load earlier messages
        </button>
      )}
    </div>
  );
}
