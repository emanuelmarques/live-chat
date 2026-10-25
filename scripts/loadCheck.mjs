// One-off manual verification for SC-001/SC-002/SC-003 at ~150 participants.
// Run against a live local Convex backend: `npx convex dev` in one terminal,
// then `node scripts/loadCheck.mjs` in another. Not part of the automated test
// suite — a load-check utility, kept for future re-verification.
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const PARTICIPANT_COUNT = Number(process.env.LOADCHECK_PARTICIPANTS ?? 150);
const url = process.env.VITE_CONVEX_URL ?? "http://127.0.0.1:3210";
const client = new ConvexHttpClient(url);

async function main() {
  // There is only ever one moderator account in this system (Principle I); reuse
  // the same credentials every other test/script in this repo bootstraps with,
  // since whichever ran first on this local deployment "wins" the one account.
  const credentials = { email: "e2e-mod@example.com", password: "e2e-test-password" };
  try {
    await client.mutation(api.auth.bootstrapModerator, credentials);
  } catch {
    // Already bootstrapped by an earlier test/script run — that's fine.
  }
  const { sessionToken } = await client.mutation(api.auth.login, credentials);

  const { eventId } = await client.mutation(api.events.createEvent, {
    sessionToken,
    name: `Load check ${Date.now()}`,
  });

  const joinStart = Date.now();
  const participants = await Promise.all(
    Array.from({ length: PARTICIPANT_COUNT }, (_, i) =>
      client.mutation(api.participants.joinEvent, { eventId, displayName: `Participant ${i}` }),
    ),
  );
  const joinMs = Date.now() - joinStart;

  const sendStart = Date.now();
  await Promise.all(
    participants.map((p, i) =>
      client.mutation(api.messages.sendMessage, {
        eventId,
        participantId: p.participantId,
        content: `Message from participant ${i}`,
      }),
    ),
  );
  const sendMs = Date.now() - sendStart;

  // Poll listMessages until all messages are visible, simulating "how long until
  // a projector/participant view reflects every message" (SC-002).
  const propagationStart = Date.now();
  let visible = [];
  while (visible.length < PARTICIPANT_COUNT && Date.now() - propagationStart < 10_000) {
    visible = await client.query(api.messages.listMessages, { eventId });
  }
  const propagationMs = Date.now() - propagationStart;

  console.log(`Joined ${PARTICIPANT_COUNT} participants in ${joinMs}ms (SC-001: one join+message well under 60s each)`);
  console.log(`Sent ${PARTICIPANT_COUNT} messages concurrently in ${sendMs}ms`);
  console.log(`All messages visible after ${propagationMs}ms (SC-002 target: ~3s); visible=${visible.length}/${PARTICIPANT_COUNT} (SC-003: no message loss)`);

  if (visible.length !== PARTICIPANT_COUNT) {
    console.error("FAIL: message loss detected.");
    process.exitCode = 1;
  } else if (propagationMs > 3000) {
    console.warn("WARN: propagation took longer than the ~3s target under this load.");
  } else {
    console.log("PASS");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
