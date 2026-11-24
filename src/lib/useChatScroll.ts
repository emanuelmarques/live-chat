import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

type PaginationStatus = "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";

const NEAR_BOTTOM_PX = 80;

/**
 * Scroll behaviour for a chat list that loads history on demand:
 *  - opens at the newest message and keeps following new ones while the reader is
 *    at the bottom (not yanking them down if they scrolled up to read);
 *  - keeps the reader's place when the list changes above them (older messages
 *    loaded on top, or the oldest ones sliding out of the newest page);
 *  - asks for the next page of older messages when `topRef` scrolls into view.
 *
 * `contentVersion` is anything that changes the list's height without changing
 * `messages` (e.g. reaction chips), so a reader at the bottom stays there.
 */
export function useChatScroll(
  messages: { messageId: string }[] | undefined,
  status: PaginationStatus,
  loadOlder: () => void,
  contentVersion?: unknown,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const initialised = useRef(false);
  // The first message in view and where it sits, to restore after the list changes.
  const anchor = useRef<{ id: string; top: number } | null>(null);

  const captureAnchor = useCallback((el: HTMLElement) => {
    const rootTop = el.getBoundingClientRect().top;
    anchor.current = null;
    for (const item of el.querySelectorAll<HTMLElement>("[data-message-id]")) {
      const rect = item.getBoundingClientRect();
      if (rect.bottom > rootTop + 1) {
        anchor.current = { id: item.dataset.messageId!, top: rect.top - rootTop };
        return;
      }
    }
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    captureAnchor(el);
  }, [captureAnchor]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !messages) return;
    if (!initialised.current || atBottom.current) {
      el.scrollTop = el.scrollHeight;
      atBottom.current = true;
      initialised.current = true;
    } else if (anchor.current) {
      const item = el.querySelector<HTMLElement>(`[data-message-id="${anchor.current.id}"]`);
      if (item) {
        const top = item.getBoundingClientRect().top - el.getBoundingClientRect().top;
        el.scrollTop += top - anchor.current.top;
      }
    }
    captureAnchor(el);
  }, [messages, status, contentVersion, captureAnchor]);

  const hasList = messages !== undefined;
  useEffect(() => {
    const root = scrollRef.current;
    const target = topRef.current;
    if (!hasList || status !== "CanLoadMore" || !root || !target || typeof IntersectionObserver === "undefined") {
      return;
    }
    // A fresh observer reports the current state straight away, so if the top is
    // still in view after a page loaded (short pages), the next one is requested.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadOlder();
      },
      { root, rootMargin: "200px 0px 0px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasList, status, loadOlder]);

  return { scrollRef, topRef, onScroll };
}
