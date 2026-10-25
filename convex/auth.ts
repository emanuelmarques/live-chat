import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { hashPassword, verifyPassword } from "./lib/password";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/**
 * One-time setup: creates the single v1 moderator account. Guarded so it can
 * only succeed while no moderator exists yet (constitution Principle I — the
 * `moderators` table supports more rows later, but nothing builds that now).
 */
export const bootstrapModerator = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    const existing = await ctx.db.query("moderators").first();
    if (existing !== null) {
      throw new Error("A moderator account already exists.");
    }
    const passwordHash = await hashPassword(password);
    const moderatorId = await ctx.db.insert("moderators", {
      email,
      passwordHash,
      createdAt: Date.now(),
    });
    return { moderatorId };
  },
});

export const login = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    const moderator = await ctx.db
      .query("moderators")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (moderator === null || !(await verifyPassword(password, moderator.passwordHash))) {
      throw new Error("Invalid email or password.");
    }
    const now = Date.now();
    const token = crypto.randomUUID();
    await ctx.db.insert("sessions", {
      moderatorId: moderator._id,
      token,
      createdAt: now,
      expiresAt: now + SESSION_DURATION_MS,
    });
    return { sessionToken: token };
  },
});

export const getSession = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", sessionToken))
      .first();
    if (session === null || session.expiresAt < Date.now()) {
      return null;
    }
    return { moderatorId: session.moderatorId };
  },
});
