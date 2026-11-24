import { useQuery, api, type Id } from "../../../lib/convexClient";
import { getStoredSessionToken } from "../../../lib/session";

function formatTime(ms: number | null) {
  return ms === null ? "—" : new Date(ms).toLocaleString();
}

export function PollHistory({ eventId }: { eventId: Id<"events"> }) {
  const sessionToken = getStoredSessionToken() ?? "";
  const history = useQuery(api.polls.listPollHistory, { sessionToken, eventId });

  if (history === undefined) return <p role="status">Loading…</p>;

  return (
    <div className="stack">
      {history.length === 0 ? (
        <p style={{ margin: 0 }}>No polls have been run in this event yet.</p>
      ) : (
        history.map((poll) => {
          const top = Math.max(...poll.counts);
          return (
            <article key={poll.pollId} className="card stack" aria-label={poll.question}>
              <p className="mono-label" style={{ margin: 0 }}>
                {poll.isActive ? "Live now" : "Ended"} · {poll.totalVotes} vote(s)
              </p>
              <h2 style={{ margin: 0 }}>{poll.question}</h2>
              <p style={{ margin: 0 }}>
                Started {formatTime(poll.startedAt)}
                {!poll.isActive && ` · Ended ${formatTime(poll.endedAt)}`}
              </p>
              <ul className="poll__options">
                {poll.options.map((option, i) => {
                  const count = poll.counts[i];
                  const pct = poll.totalVotes > 0 ? Math.round((count / poll.totalVotes) * 100) : 0;
                  return (
                    <li key={i}>
                      <div className="poll__option">
                        <span>
                          {option}
                          {top > 0 && count === top ? " ★" : ""}
                        </span>
                        <span className="poll__count">
                          {count} vote(s) · {pct}%
                        </span>
                      </div>
                      <div className="bar" aria-hidden="true">
                        <i style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })
      )}
    </div>
  );
}
