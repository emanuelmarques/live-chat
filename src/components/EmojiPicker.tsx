import { useEffect, useMemo, useRef, useState } from "react";
import { loadEmojiData, searchEmoji, type EmojiEntry } from "../lib/emojiData";
import { useDismissablePopover } from "../lib/useDismissablePopover";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  "Smileys & Emotion": "😀",
  "People & Body": "🧑",
  "Animals & Nature": "🐻",
  "Food & Drink": "🍔",
  "Travel & Places": "✈️",
  Activities: "⚽",
  Objects: "💡",
  Symbols: "❤️",
  Flags: "🏳️",
};

/** Full emoji picker: search, category jump bar, and a scrollable grid — like any mainstream chat app. */
export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<EmojiEntry[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const groupRefs = useRef(new Map<string, HTMLDivElement>());

  useDismissablePopover(containerRef, open, () => setOpen(false));

  useEffect(() => {
    let active = true;
    loadEmojiData().then((entries) => {
      if (active) setData(entries);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const groups = useMemo(() => {
    if (!data) return [];
    const byGroup = new Map<string, EmojiEntry[]>();
    for (const entry of data) {
      const list = byGroup.get(entry.group);
      if (list) list.push(entry);
      else byGroup.set(entry.group, [entry]);
    }
    return [...byGroup.entries()];
  }, [data]);

  const searchResults = useMemo(() => {
    if (!data || query.trim().length === 0) return null;
    return searchEmoji(data, query, 120);
  }, [data, query]);

  function pick(emoji: string) {
    onSelect(emoji);
    searchRef.current?.focus();
  }

  function jumpTo(groupName: string) {
    groupRefs.current.get(groupName)?.scrollIntoView({ block: "start" });
  }

  return (
    <div className="emoji-picker-trigger" ref={containerRef}>
      <button
        type="button"
        className="emoji-picker-trigger__button"
        aria-label="Add an emoji"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        😊
      </button>
      {open && (
        <div className="emoji-picker" role="dialog" aria-label="Emoji picker">
          <input
            ref={searchRef}
            type="text"
            className="emoji-picker__search"
            placeholder="Search emoji…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search emoji"
          />
          {searchResults === null && groups.length > 0 && (
            <div className="emoji-picker__categories" role="group" aria-label="Jump to a category">
              {groups.map(([groupName]) => (
                <button
                  key={groupName}
                  type="button"
                  className="emoji-picker__category"
                  title={groupName}
                  aria-label={`Jump to ${groupName}`}
                  onClick={() => jumpTo(groupName)}
                >
                  {CATEGORY_ICONS[groupName] ?? "🔸"}
                </button>
              ))}
            </div>
          )}
          <div className="emoji-picker__grid">
            {data === null && <p className="emoji-picker__status">Loading…</p>}
            {searchResults !== null ? (
              searchResults.length === 0 ? (
                <p className="emoji-picker__status">No matches.</p>
              ) : (
                <div className="emoji-picker__row">
                  {searchResults.map((entry) => (
                    <button
                      key={entry.slug}
                      type="button"
                      className="emoji-picker__item"
                      title={`:${entry.slug}:`}
                      aria-label={entry.name}
                      onClick={() => pick(entry.emoji)}
                    >
                      {entry.emoji}
                    </button>
                  ))}
                </div>
              )
            ) : (
              groups.map(([groupName, groupEntries]) => (
                <div
                  key={groupName}
                  className="emoji-picker__group"
                  ref={(el) => {
                    if (el) groupRefs.current.set(groupName, el);
                    else groupRefs.current.delete(groupName);
                  }}
                >
                  <div className="emoji-picker__group-label">{groupName}</div>
                  <div className="emoji-picker__row">
                    {groupEntries.map((entry) => (
                      <button
                        key={entry.slug}
                        type="button"
                        className="emoji-picker__item"
                        title={`:${entry.slug}:`}
                        aria-label={entry.name}
                        onClick={() => pick(entry.emoji)}
                      >
                        {entry.emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
