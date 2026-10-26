import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  findClosedShortcode,
  findOpenShortcode,
  loadEmojiData,
  searchEmoji,
  type EmojiEntry,
} from "./emojiData";

interface OpenQuery {
  start: number;
  query: string;
}

/**
 * Wires a plain text `<input>` up to Slack-style emoji shortcodes: typing a
 * complete ":slug:" replaces it immediately, and an unclosed ":partial"
 * drives a small autocomplete dropdown (↑/↓ to move, Enter/Tab to accept,
 * Escape to dismiss). Also exposes `insertAtCaret` for a picker UI to insert
 * an emoji at the current cursor position rather than always appending.
 */
export function useEmojiComposer(content: string, setContent: (value: string) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [entries, setEntries] = useState<EmojiEntry[] | null>(null);
  const [openQuery, setOpenQuery] = useState<OpenQuery | null>(null);
  const [highlighted, setHighlighted] = useState(0);

  useEffect(() => {
    let active = true;
    loadEmojiData().then((data) => {
      if (active) setEntries(data);
    });
    return () => {
      active = false;
    };
  }, []);

  // Restores the caret after a programmatic insert/replace causes a re-render
  // (the browser resets it to the end of the value otherwise).
  useEffect(() => {
    if (pendingCaret.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [content]);

  const slugIndex = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of entries ?? []) map.set(entry.slug, entry.emoji);
    return map;
  }, [entries]);

  const suggestions = useMemo(() => {
    if (!entries || !openQuery || openQuery.query.length === 0) return [];
    return searchEmoji(entries, openQuery.query, 8);
  }, [entries, openQuery]);

  function insertAtCaret(emoji: string) {
    const input = inputRef.current;
    const start = input?.selectionStart ?? content.length;
    const end = input?.selectionEnd ?? content.length;
    pendingCaret.current = start + emoji.length;
    setContent(content.slice(0, start) + emoji + content.slice(end));
    setOpenQuery(null);
    input?.focus();
  }

  function acceptSuggestion(entry: EmojiEntry) {
    if (!openQuery) return;
    const caret = inputRef.current?.selectionStart ?? content.length;
    pendingCaret.current = openQuery.start + entry.emoji.length;
    setContent(content.slice(0, openQuery.start) + entry.emoji + content.slice(caret));
    setOpenQuery(null);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    const caret = event.target.selectionStart ?? value.length;

    const closed = findClosedShortcode(value.slice(0, caret));
    const closedEmoji = closed ? slugIndex.get(closed.slug) : undefined;
    if (closed && closedEmoji) {
      pendingCaret.current = closed.start + closedEmoji.length;
      setContent(value.slice(0, closed.start) + closedEmoji + value.slice(closed.end));
      setOpenQuery(null);
      return;
    }

    setContent(value);
    setOpenQuery(findOpenShortcode(value.slice(0, caret)));
    setHighlighted(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((h) => (h + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      acceptSuggestion(suggestions[highlighted]);
    } else if (event.key === "Escape") {
      setOpenQuery(null);
    }
  }

  function closeSuggestions() {
    setOpenQuery(null);
  }

  return {
    inputRef,
    suggestions,
    highlighted,
    insertAtCaret,
    acceptSuggestion,
    handleChange,
    handleKeyDown,
    closeSuggestions,
  };
}
