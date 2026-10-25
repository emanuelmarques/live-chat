import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireModerator } from "./lib/requireModerator";
import { toCsvRow } from "./lib/csv";

export const exportChatCsv = query({
  args: { sessionToken: v.string(), eventId: v.id("events") },
  handler: async (ctx, { sessionToken, eventId }) => {
    await requireModerator(ctx, sessionToken);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_event_sentAt", (q) => q.eq("eventId", eventId))
      .collect();

    const visible = messages.filter(
      (m) => m.moderationStatus === "visible" && m.deletedAt === null,
    );

    const rows = [toCsvRow(["sender", "content", "sentAt"])];
    for (const m of visible) {
      rows.push(toCsvRow([m.authorDisplayName, m.content, new Date(m.sentAt).toISOString()]));
    }
    return { csv: rows.join("\n") };
  },
});
