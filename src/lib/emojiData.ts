export interface EmojiEntry {
  emoji: string;
  name: string;
  /** Also doubles as the Slack-style shortcode, e.g. "fire" for 🔥 (":fire:"). */
  slug: string;
  group: string;
}

let dataPromise: Promise<EmojiEntry[]> | null = null;

/**
 * Loads the full emoji dataset (~1900 entries) via a dynamic import so it
 * lands in its own chunk instead of bloating the main bundle. Call it eagerly
 * on chat mount to prefetch, then again (cheaply, from cache) wherever it's
 * needed — composer autocomplete, the picker, etc.
 */
export function loadEmojiData(): Promise<EmojiEntry[]> {
  if (!dataPromise) {
    dataPromise = import("unicode-emoji-json/data-by-group.json").then((module) =>
      module.default.flatMap((group) =>
        group.emojis.map((entry) => ({
          emoji: entry.emoji,
          name: entry.name,
          slug: entry.slug,
          group: group.name,
        })),
      ),
    );
  }
  return dataPromise;
}

export function searchEmoji(data: EmojiEntry[], rawQuery: string, limit = 50): EmojiEntry[] {
  const query = rawQuery.trim().toLowerCase();
  if (query.length === 0) return data.slice(0, limit);

  // Ranked so an exact slug match (":fire:" -> 🔥) always wins over a merely
  // related one (🧑‍🚒 "firefighter" also starts with "fire").
  const exact: EmojiEntry[] = [];
  const bySlugPrefix: EmojiEntry[] = [];
  const byOtherMatch: EmojiEntry[] = [];
  for (const entry of data) {
    if (entry.slug === query) {
      exact.push(entry);
    } else if (entry.slug.startsWith(query)) {
      bySlugPrefix.push(entry);
    } else if (entry.slug.includes(query) || entry.name.includes(query)) {
      byOtherMatch.push(entry);
    }
  }
  return [...exact, ...bySlugPrefix, ...byOtherMatch].slice(0, limit);
}

export interface OpenShortcode {
  /** Index into the input value where the triggering ":" starts. */
  start: number;
  query: string;
}

// An unclosed ":word" right before the caret — drives the autocomplete dropdown.
const OPEN_SHORTCODE = /:([a-z0-9_+-]{0,40})$/i;

export function findOpenShortcode(textBeforeCaret: string): OpenShortcode | null {
  const match = OPEN_SHORTCODE.exec(textBeforeCaret);
  if (!match) return null;
  // Require a word boundary before the ":" so "e:g" or "10:30" don't trigger it.
  const precedingChar = textBeforeCaret[match.index - 1];
  if (precedingChar && /[a-z0-9_]/i.test(precedingChar)) return null;
  return { start: match.index, query: match[1] };
}

export interface ClosedShortcode {
  start: number;
  end: number;
  slug: string;
}

// A just-completed ":word:" right before the caret — Slack-style instant replace.
const CLOSED_SHORTCODE = /:([a-z0-9_+-]{1,40}):$/i;

export function findClosedShortcode(textBeforeCaret: string): ClosedShortcode | null {
  const match = CLOSED_SHORTCODE.exec(textBeforeCaret);
  if (!match) return null;
  return { start: match.index, end: match.index + match[0].length, slug: match[1].toLowerCase() };
}
