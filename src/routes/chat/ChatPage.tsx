import { useState, type FormEvent } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useQuery, useMutation, api, type Id } from "../../lib/convexClient";
import { getStoredParticipant } from "../../lib/participant";
import { hasVotedInPoll, markPollVoted } from "../../lib/pollVotes";
import { MessageList, type MessageRow } from "../../components/MessageList";
import { PollBanner } from "../../components/PollBanner";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";

const QUICK_EMOJI = ["😀", "👍", "🎉", "❤️", "😂", "🙏"];

export function ChatPage() {
  const { joinSlug } = useParams<{ joinSlug: string }>();
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const info = useQuery(api.events.getJoinInfo, joinSlug ? { joinSlug } : "skip");
  const messages = useQuery(api.messages.listMessages, info ? { eventId: info.eventId } : "skip");
  const participantForQuery = joinSlug ? getStoredParticipant(joinSlug) : null;
  const ownPendingOrRejected = useQuery(
    api.messages.listOwnPendingOrRejected,
    info && participantForQuery
      ? {
          eventId: info.eventId,
          participantId: participantForQuery.participantId as Id<"participants">,
        }
      : "skip",
  );
  const sendMessage = useMutation(api.messages.sendMessage);
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const activePoll = useQuery(api.polls.getActivePoll, info ? { eventId: info.eventId } : "skip");
  const castVote = useMutation(api.polls.castVote);

  if (!joinSlug) {
    return <main><EmptyState>Invalid link.</EmptyState></main>;
  }
  const participant = getStoredParticipant(joinSlug);
  if (!participant) {
    return <Navigate to={`/join/${joinSlug}`} replace />;
  }
  if (info === undefined || messages === undefined) {
    return <main><p role="status">Loading…</p></main>;
  }
  if (info === null) {
    return <main><EmptyState>We couldn't find this event.</EmptyState></main>;
  }
  if (info.status === "ended") {
    return <main><EmptyState>This event has ended.</EmptyState></main>;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = content.trim();
    if (trimmed.length === 0) return;
    try {
      await sendMessage({
        eventId: info!.eventId,
        participantId: participant!.participantId as Id<"participants">,
        content: trimmed,
        replyToMessageId: replyTo ? (replyTo.messageId as Id<"messages">) : undefined,
      });
      setContent("");
      setReplyTo(null);
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("RateLimited")
          ? "You're sending messages too quickly — please slow down."
          : "Couldn't send that message. Please try again.",
      );
    }
  }

  async function handleDelete(messageId: string) {
    await deleteMessage({
      messageId: messageId as Id<"messages">,
      participantId: participant!.participantId as Id<"participants">,
    });
  }

  async function handleVote(optionIndex: number) {
    if (!activePoll) return;
    await castVote({
      pollId: activePoll.pollId as Id<"polls">,
      participantId: participant!.participantId as Id<"participants">,
      optionIndex,
    });
    markPollVoted(activePoll.pollId);
  }

  return (
    <main className={`shell chat${activePoll ? " chat--poll" : ""}`}>
      <header className="chat__header">
        <div className="mono-label" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--live-text)" }}>
          <span className="live-dot" aria-hidden="true" />
          Live
          <span style={{ color: "var(--muted)" }}>· you are {participant.displayName}</span>
        </div>
        <h1 className="chat__title">{info.name}</h1>
      </header>
      {activePoll && (
        <div className="chat__poll">
          <PollBanner
            poll={activePoll}
            onVote={handleVote}
            hasVoted={hasVotedInPoll(activePoll.pollId)}
          />
        </div>
      )}
      <div className="chat__scroll">
        <MessageList
          messages={messages}
          currentParticipantId={participant.participantId}
          onDelete={handleDelete}
          onReply={(message) => setReplyTo(message)}
        />
        {ownPendingOrRejected && ownPendingOrRejected.length > 0 && (
          <ul className="msgs" style={{ marginTop: "0.75rem" }}>
            {ownPendingOrRejected.map((m) => (
              <li key={m.messageId} role="status" className="pending">
                {m.content}
                <div className="pending__status">
                  {m.moderationStatus === "pending"
                    ? "Awaiting approval · only you see this"
                    : "Not approved by the moderator"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="chat__footer">
        {replyTo && (
          <div className="reply-chip">
            <span>Replying to {replyTo.authorDisplayName}</span>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
              ✕
            </button>
          </div>
        )}

        <div className="emoji-row" role="group" aria-label="Insert emoji">
          {QUICK_EMOJI.map((emoji) => (
            <button key={emoji} type="button" onClick={() => setContent((c) => c + emoji)}>
              {emoji}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="composer">
          <label htmlFor="composer" className="visually-hidden">
            Type a message
          </label>
          <input
            id="composer"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type a message…"
          />
          <Button type="submit" className="composer__send">
            Send
          </Button>
        </form>
        {error && (
          <p role="alert" className="alert" style={{ marginTop: "0.5rem" }}>
            {error}
          </p>
        )}
      </footer>
    </main>
  );
}
