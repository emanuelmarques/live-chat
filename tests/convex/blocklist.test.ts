import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { matchesAnyTerm } from "../../convex/lib/blocklist";
import { createModeratorSession, newTestInstance } from "./testHelpers";

describe("matchesAnyTerm", () => {
  test("ignores case and accents in both directions", () => {
    expect(matchesAnyTerm("és um CABRAO", ["cabrão"])).toBe(true);
    expect(matchesAnyTerm("és um cabrão", ["cabrao"])).toBe(true);
  });

  test("matches at word start only — no false positives inside other words", () => {
    expect(matchesAnyTerm("o meu computador", ["puta"])).toBe(false);
    expect(matchesAnyTerm("a reputação", ["puta"])).toBe(false);
    expect(matchesAnyTerm("sua puta!", ["puta"])).toBe(true);
    expect(matchesAnyTerm("putas", ["puta"])).toBe(true);
  });

  test("matches multi-word phrases and links", () => {
    expect(matchesAnyTerm("vai para o  Caralho", ["vai para o caralho"])).toBe(true);
    expect(matchesAnyTerm("vê https://t.me/x", ["t.me"])).toBe(true);
  });
});

describe("default block-list", () => {
  test("bootstrapModerator seeds defaults and addDefaultBlockList is idempotent", async () => {
    const t = newTestInstance();
    const sessionToken = await createModeratorSession(t);

    const before = await t.query(api.moderation.listBlockListEntries, { sessionToken });
    expect(before.length).toBeGreaterThan(0);

    const { added } = await t.mutation(api.moderation.addDefaultBlockList, { sessionToken });
    expect(added).toBe(0);
  });

  test("backfill adds missing defaults for an existing moderator", async () => {
    const t = newTestInstance();
    const sessionToken = await createModeratorSession(t);
    const entries = await t.query(api.moderation.listBlockListEntries, { sessionToken });
    for (const e of entries) {
      await t.mutation(api.moderation.removeBlockListEntry, { sessionToken, entryId: e.entryId });
    }

    const result = await t.mutation(internal.moderation.seedDefaultsForExistingModerators, {});
    expect(result.added).toBe(entries.length);
  });
});
