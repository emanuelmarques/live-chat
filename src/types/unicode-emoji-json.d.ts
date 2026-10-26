declare module "unicode-emoji-json/data-by-group.json" {
  interface RawEmojiEntry {
    emoji: string;
    name: string;
    slug: string;
    skin_tone_support: boolean;
  }

  interface RawEmojiGroup {
    name: string;
    slug: string;
    emojis: RawEmojiEntry[];
  }

  const groups: RawEmojiGroup[];
  export default groups;
}
