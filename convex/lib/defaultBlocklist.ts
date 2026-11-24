import type { DatabaseWriter } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { normalizeText } from "./blocklist";

/**
 * Default block-list (PT-PT + EN). Matching is accent/case-insensitive and anchored
 * at word start (see `matchesAnyTerm`), so accents need not be duplicated.
 * A match only holds the message for the moderator — it never rejects it.
 */
export const DEFAULT_BLOCKLIST_TERMS: readonly string[] = [
  // Profanity & insults — PT
  "caralho", "porra", "foda-se", "fodase", "foder", "fodido", "merda", "cabrão",
  "puta", "filho da puta", "filhodaputa", "fdp", "paneleiro", "maricas", "bicha",
  "idiota", "imbecil", "estúpido", "otário", "atrasado mental",
  "vai-te foder", "vai para o caralho", "vai à merda",
  // Profanity & insults — EN
  "fuck", "shit", "bullshit", "bitch", "asshole", "bastard", "dickhead", "cunt",
  "motherfucker", "wanker",
  // Hate speech
  "monhé", "nigger", "nigga", "faggot", "retarded", "tranny",
  // Spam / links
  "http://", "https://", "www.", "bit.ly", "tinyurl", "t.me", "discord.gg",
  "ganha dinheiro", "click here", "free followers",
];

/** Inserts the defaults this moderator doesn't have yet. Returns how many were added. */
export async function insertMissingDefaultTerms(
  db: DatabaseWriter,
  moderatorId: Id<"moderators">,
): Promise<number> {
  const existing = await db
    .query("blockListEntries")
    .withIndex("by_moderator", (q) => q.eq("moderatorId", moderatorId))
    .collect();
  const have = new Set(existing.map((e) => normalizeText(e.term)));
  const now = Date.now();
  let added = 0;
  for (const term of DEFAULT_BLOCKLIST_TERMS) {
    const key = normalizeText(term);
    if (have.has(key)) continue;
    have.add(key);
    await db.insert("blockListEntries", { moderatorId, term, addedAt: now });
    added++;
  }
  return added;
}
