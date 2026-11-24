/* global performance, setTimeout, setInterval */
// Realistic load test: N phones (default 150) connected over WebSocket, each
// subscribed to the same live queries the chat page uses, while they chat,
// react to messages, fire flying reactions and vote in a poll.
//
//   npx convex dev            # in one terminal
//   node scripts/loadTest.mjs # in another
//
// Env: LOADTEST_PARTICIPANTS (150), LOADTEST_SECONDS (60), LOADTEST_PACE (1), VITE_CONVEX_URL.
// Not part of the automated suite. Against a local backend the numbers are a
// lower bound for what the network adds, not a production prediction.
import { ConvexClient, ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const N = Number(process.env.LOADTEST_PARTICIPANTS ?? 150);
const SECONDS = Number(process.env.LOADTEST_SECONDS ?? 60);
// 1 = every phone acts every 2-9s (a stress test, ~25 actions/s overall); 5 = every 10-45s, closer to a lively real chat.
const PACE = Number(process.env.LOADTEST_PACE ?? 1);
const url = process.env.VITE_CONVEX_URL ?? "http://127.0.0.1:3210";
const PAGE_SIZE = 50; // the chat page's first page (MESSAGES_PAGE_SIZE)
const EMOJIS = ["👍", "👎", "❤️", "🎉", "😂", "👏", "😮", "🔥", "💯"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const pct = (arr, p) => (arr.length ? [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))] : NaN);
const fmt = (arr) =>
  `n=${arr.length} p50=${pct(arr, 50).toFixed(0)}ms p95=${pct(arr, 95).toFixed(0)}ms p99=${pct(arr, 99).toFixed(0)}ms max=${Math.max(...arr).toFixed(0)}ms`;

const errors = new Map();
const lat = { join: [], message: [], msgReaction: [], flying: [], vote: [] };
async function timed(kind, fn) {
  const t0 = performance.now();
  try {
    const r = await fn();
    lat[kind].push(performance.now() - t0);
    return r;
  } catch (e) {
    const key = `${kind}: ${String(e.message).split("\n").find((l) => /Error:|RateLimited|Kicked|already/.test(l))?.trim().slice(0, 90) ?? "unknown"}`;
    errors.set(key, (errors.get(key) ?? 0) + 1);
    return undefined;
  }
}

const lagSamples = [];
let lastTick = performance.now();
setInterval(() => {
  const now = performance.now();
  lagSamples.push(Math.max(0, now - lastTick - 100));
  lastTick = now;
}, 100).unref();

async function main() {
  const http = new ConvexHttpClient(url);
  const creds = { email: "e2e-mod@example.com", password: "e2e-test-password" };
  try {
    await http.mutation(api.auth.bootstrapModerator, creds);
  } catch {
    // Already bootstrapped — fine.
  }
  const login = await http.mutation(api.auth.login, creds);
  if (!login.ok) throw new Error(`login failed: ${login.reason}`);
  const sessionToken = login.sessionToken;
  const { eventId } = await http.mutation(api.events.createEvent, { sessionToken, name: `Load test ${Date.now()}` });

  // --- connect N phones + 1 projector, each with the chat page's live queries
  const clients = [];
  const seenAt = new Map(); // marker -> Map(clientIdx -> time)
  const updates = new Array(N + 1).fill(0);
  const reactionUpdates = new Array(N + 1).fill(0);
  let lastListBytes = 0;
  let lastReactionBytes = 0;
  let lastPageLength = 0;
  let observedBytes = 0;
  const OBSERVERS = 10; // clients whose per-message arrival time we record
  const tConnect = performance.now();
  for (let i = 0; i <= N; i++) {
    const c = new ConvexClient(url);
    clients.push(c);
    // Same subscriptions as the chat page: the newest page of messages (split in two by the
    // client once it holds more than twice the page size, like usePaginatedQuery does), plus
    // reaction counts for the loaded window (re-subscribed only when the 5-minute bucket of
    // its oldest message changes).
    const pages = new Map(); // key -> newest sentAt of the page's oldest message
    let nextPage = 0;
    let reactionsSince = null;
    let stopReactions = () => {};
    const subscribePage = (paginationOpts) => {
      const key = nextPage++;
      const isNewest = paginationOpts.cursor === null;
      const stop = c.onUpdate(api.messages.listMessages, { eventId, paginationOpts }, (res) => {
        updates[i]++;
        const list = res.page;
        if (i <= OBSERVERS) {
          const bytes = JSON.stringify(res).length; // observers only: stringifying all 150 would skew the test
          observedBytes += bytes;
          if (isNewest) {
            lastListBytes = i === 0 ? bytes : lastListBytes;
            if (i === 0) lastPageLength = list.length;
          }
          const now = performance.now();
          for (const m of list) {
            let per = seenAt.get(m.content);
            if (!per) seenAt.set(m.content, (per = new Map()));
            if (!per.has(i)) per.set(i, now);
          }
        }
        if (list.length > PAGE_SIZE * 2 && res.splitCursor) {
          stop();
          pages.delete(key);
          subscribePage({ ...paginationOpts, numItems: PAGE_SIZE, endCursor: res.splitCursor });
          subscribePage({ numItems: PAGE_SIZE, cursor: res.splitCursor, endCursor: res.continueCursor });
          return;
        }
        if (list.length > 0) pages.set(key, list[list.length - 1].sentAt);
        if (pages.size === 0) return;
        const since = Math.floor(Math.min(...pages.values()) / 300_000) * 300_000;
        if (since !== reactionsSince) {
          stopReactions();
          reactionsSince = since;
          stopReactions = c.onUpdate(api.messageReactions.listMessageReactions, { eventId, since }, (counts) => {
            reactionUpdates[i]++;
            if (i <= OBSERVERS) {
              const bytes = JSON.stringify(counts).length;
              observedBytes += bytes;
              if (i === 0) lastReactionBytes = bytes;
            }
          });
        }
      });
    };
    subscribePage({ numItems: PAGE_SIZE, cursor: null });
    c.onUpdate(api.reactions.listRecentReactions, { eventId }, () => {});
    c.onUpdate(api.polls.getActivePoll, { eventId }, () => {});
    if (i % 25 === 0) await sleep(50);
  }
  await sleep(1500);
  console.log(`Connected ${N + 1} websocket clients in ${(performance.now() - tConnect).toFixed(0)}ms`);

  // --- join
  const phones = clients.slice(1);
  const tJoin = performance.now();
  const people = await Promise.all(
    phones.map((c, i) => timed("join", () => c.mutation(api.participants.joinEvent, { eventId, displayName: `Load ${i}` }))),
  );
  console.log(`All ${N} joined in ${(performance.now() - tJoin).toFixed(0)}ms (burst, like a QR scan at the start)`);
  const ids = people.map((p) => p?.participantId);

  // --- activity
  const sentAt = new Map();
  const deadline = performance.now() + SECONDS * 1000;
  let msgSeq = 0;
  const messageIds = [];
  const loops = phones.map(async (c, i) => {
    const pid = ids[i];
    if (!pid) return;
    await sleep(rand(0, 5000) * PACE);
    while (performance.now() < deadline) {
      const roll = Math.random();
      if (roll < 0.35) {
        const marker = `msg-${i}-${msgSeq++}`;
        sentAt.set(marker, performance.now());
        const r = await timed("message", () => c.mutation(api.messages.sendMessage, { eventId, participantId: pid, content: marker }));
        if (r) messageIds.push(r.messageId);
        else sentAt.delete(marker);
      } else if (roll < 0.7 && messageIds.length) {
        const messageId = messageIds[Math.floor(Math.random() * messageIds.length)];
        await timed("msgReaction", () =>
          c.mutation(api.messageReactions.toggleMessageReaction, { messageId, participantId: pid, emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)] }),
        );
      } else {
        await timed("flying", () => c.mutation(api.reactions.sendReaction, { eventId, participantId: pid, emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)] }));
      }
      await sleep(rand(2000, 9000) * PACE); // a phone user acts every few seconds (x PACE)
    }
  });

  // --- poll in the middle: everyone votes within ~8s
  const poll = (async () => {
    await sleep((SECONDS * 1000) / 2);
    const { pollId } = await http.mutation(api.polls.createAndStartPoll, {
      sessionToken, eventId, question: "Load test poll?", options: ["A", "B", "C"], revealMode: "live",
    });
    const t0 = performance.now();
    await Promise.all(
      phones.map(async (c, i) => {
        await sleep(rand(0, 8000));
        if (ids[i]) await timed("vote", () => c.mutation(api.polls.castVote, { pollId, participantId: ids[i], optionIndex: i % 3 }));
      }),
    );
    // wait for the live tally to converge on a projector-like client
    let total = 0;
    const tEnd = performance.now() + 10_000;
    while (performance.now() < tEnd) {
      const p = await http.query(api.polls.getActivePoll, { eventId });
      total = p?.counts?.reduce((a, b) => a + b, 0) ?? 0;
      if (total >= lat.vote.length) break;
      await sleep(200);
    }
    console.log(`Poll: ${lat.vote.length}/${N} votes accepted, tally=${total}, burst took ${(performance.now() - t0).toFixed(0)}ms`);
    await http.mutation(api.polls.endPoll, { sessionToken, pollId });
  })();

  await Promise.all([...loops, poll]);
  await sleep(3000); // let the last updates land

  // --- results
  const arrival = [];
  let missing = 0;
  for (const [marker, t0] of sentAt) {
    const per = seenAt.get(marker);
    for (let i = 1; i <= OBSERVERS; i++) {
      const t = per?.get(i);
      if (t) arrival.push(t - t0);
      else missing++;
    }
  }
  // Read the whole history back page by page (what scrolling up does), on the HTTP client and on a few phones.
  const fetchAll = async (client) => {
    const all = [];
    let cursor = null;
    for (;;) {
      const res = await client.query(api.messages.listMessages, { eventId, paginationOpts: { numItems: 100, cursor } });
      all.push(...res.page);
      if (res.isDone) return all;
      cursor = res.continueCursor;
    }
  };
  const finalList = await fetchAll(http);
  const finalCounts = [];
  for (const c of clients.slice(0, 6)) finalCounts.push((await fetchAll(c)).length);
  const uniqueStored = new Set(finalList.map((m) => m.messageId)).size;

  console.log("\n=== Mutation latency (client round trip) ===");
  for (const [k, v] of Object.entries(lat)) if (v.length) console.log(`${k.padEnd(12)} ${fmt(v)}`);
  console.log("\n=== Message propagation (send -> visible on other phones) ===");
  console.log(arrival.length ? fmt(arrival) : "no data", `| never arrived: ${missing}`);
  console.log("\n=== Integrity ===");
  console.log(`messages sent ok=${sentAt.size}, stored=${finalList.length} (unique ${uniqueStored}), read back by sample clients=${finalCounts.join("/")}`);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  console.log(`newest page of messages: ${(lastListBytes / 1024).toFixed(1)} KiB per update, updates per client avg=${(sum(updates) / updates.length).toFixed(0)} max=${Math.max(...updates)}`);
  console.log(`reaction counts: ${(lastReactionBytes / 1024).toFixed(1)} KiB per update, updates per client avg=${(sum(reactionUpdates) / reactionUpdates.length).toFixed(0)} max=${Math.max(...reactionUpdates)}`);
  console.log(`newest page held ${lastPageLength} messages; measured ${(observedBytes / (OBSERVERS + 1) / 1024 / 1024).toFixed(2)} MiB pushed to each phone in ${SECONDS}s (average over the ${OBSERVERS + 1} observer phones)`);
  console.log(`load-generator event-loop lag: p50=${pct(lagSamples, 50).toFixed(0)}ms p95=${pct(lagSamples, 95).toFixed(0)}ms max=${Math.max(...lagSamples).toFixed(0)}ms (high = the test client itself is saturated)`);
  console.log("\n=== Errors ===");
  if (errors.size === 0) console.log("none");
  for (const [k, v] of errors) console.log(`${v}x ${k}`);

  const ok = missing === 0 && uniqueStored === sentAt.size && finalList.length === sentAt.size && pct(arrival, 95) < 3000;
  console.log(ok ? "\nPASS (no loss, p95 propagation < 3s)" : "\nCHECK (see above)");
  clients.forEach((c) => c.close());
  process.exit(ok ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
