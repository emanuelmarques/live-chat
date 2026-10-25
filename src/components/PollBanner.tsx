export interface ActivePoll {
  pollId: string;
  question: string;
  options: string[];
  revealMode: "live" | "atEnd";
  isActive: boolean;
  resultsVisible: boolean;
  counts?: number[];
}

interface PollBannerProps {
  poll: ActivePoll;
  onVote?: (optionIndex: number) => void;
  hasVoted?: boolean;
}

export function PollBanner({ poll, onVote, hasVoted }: PollBannerProps) {
  const counts = poll.resultsVisible ? poll.counts : undefined;
  const total = counts ? counts.reduce((sum, n) => sum + n, 0) : 0;
  return (
    <div role="region" aria-label="Poll" className="poll">
      <p className="mono-label" style={{ margin: 0 }}>
        {poll.isActive ? "Poll in progress" : "Poll results"}
        {counts ? ` · ${total} vote(s)` : ""}
      </p>
      <h2 className="poll__question">{poll.question}</h2>
      <ul className="poll__options">
        {poll.options.map((option, index) => {
          const count = counts?.[index];
          const pct = counts && total > 0 ? Math.round(((count ?? 0) / total) * 100) : 0;
          const canVote = onVote && poll.isActive;
          const inner = (
            <>
              <span>{option}</span>
              {count !== undefined && <span className="poll__count">{count} vote(s)</span>}
            </>
          );
          return (
            <li key={option}>
              {canVote ? (
                <button
                  type="button"
                  className="poll__option"
                  onClick={() => onVote(index)}
                  disabled={hasVoted}
                >
                  {inner}
                </button>
              ) : (
                <div className="poll__option">{inner}</div>
              )}
              {count !== undefined && !canVote && (
                <div className="bar" aria-hidden="true">
                  <i style={{ width: `${pct}%` }} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {hasVoted && poll.isActive && <p className="poll__note">You voted.</p>}
    </div>
  );
}
