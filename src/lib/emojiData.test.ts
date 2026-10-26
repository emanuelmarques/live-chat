import { describe, expect, test } from "vitest";
import { findClosedShortcode, findOpenShortcode, searchEmoji, type EmojiEntry } from "./emojiData";

const SAMPLE: EmojiEntry[] = [
  { emoji: "🔥", name: "fire", slug: "fire", group: "Travel & Places" },
  { emoji: "😀", name: "grinning face", slug: "grinning_face", group: "Smileys & Emotion" },
  { emoji: "🎉", name: "party popper", slug: "party_popper", group: "Activities" },
];

describe("findOpenShortcode", () => {
  test("finds an unclosed :query right before the caret", () => {
    expect(findOpenShortcode("great idea :fir")).toEqual({ start: 11, query: "fir" });
  });

  test("finds an empty query right after a bare colon", () => {
    expect(findOpenShortcode("hello :")).toEqual({ start: 6, query: "" });
  });

  test("ignores a colon glued to the end of a word (e.g. a time or ratio)", () => {
    expect(findOpenShortcode("it's 10:30")).toBeNull();
  });

  test("returns null with no trailing colon", () => {
    expect(findOpenShortcode("no colon here")).toBeNull();
  });
});

describe("findClosedShortcode", () => {
  test("matches a just-completed :slug: token", () => {
    expect(findClosedShortcode("so hyped :fire:")).toEqual({ start: 9, end: 15, slug: "fire" });
  });

  test("returns null when the token isn't closed yet", () => {
    expect(findClosedShortcode("so hyped :fire")).toBeNull();
  });
});

describe("searchEmoji", () => {
  test("empty query returns the first `limit` entries in dataset order", () => {
    expect(searchEmoji(SAMPLE, "", 2)).toEqual(SAMPLE.slice(0, 2));
  });

  test("ranks slug-prefix matches before substring matches", () => {
    const results = searchEmoji(SAMPLE, "fire");
    expect(results[0].slug).toBe("fire");
  });

  test("matches by name as well as slug", () => {
    const results = searchEmoji(SAMPLE, "party");
    expect(results.map((r) => r.emoji)).toEqual(["🎉"]);
  });

  test("is case-insensitive", () => {
    expect(searchEmoji(SAMPLE, "FIRE").map((r) => r.emoji)).toEqual(["🔥"]);
  });
});
