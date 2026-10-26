import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useQuery, useMutation, api, type Id } from "../../lib/convexClient";
import { getStoredParticipant } from "../../lib/participant";
import { hasVotedInPoll, markPollVoted } from "../../lib/pollVotes";
import { useEmojiComposer } from "../../lib/useEmojiComposer";
import { useReactionFlights } from "../../lib/useReactionFlights";
import { MessageList, type MessageRow } from "../../components/MessageList";
import { PollBanner } from "../../components/PollBanner";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { EventNotFound } from "../../components/EventNotFound";
import { ParticipantRemoved } from "../../components/ParticipantRemoved";
import { ReactionBar } from "../../components/ReactionBar";
import { EmojiPicker } from "../../components/EmojiPicker";
import { FlyingReactions } from "../../components/FlyingReactions";
import { useDismissablePopover } from "../../lib/useDismissablePopover";

export function ChatPage() {
  const { joinSlug } = useParams<{ joinSlug: string }>();
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const composerWrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolledToLatest = useRef(false);

  const info = useQuery(api.events.getJoinInfo, joinSlug ? { joinSlug } : "skip");
  const messages = useQuery(api.messages.listMessages, info ? { eventId: info.eventId } : "skip");
  const reactions = useQuery(api.reactions.listRecentReactions, info ? { eventId: info.eventId } : "skip");
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
  const participantStatus = useQuery(
    api.participants.getParticipantStatus,
    info && participantForQuery
      ? {
          eventId: info.eventId,
          participantId: participantForQuery.participantId as Id<"participants">,
        }
      : "skip",
  );
  const sendMessage = useMutation(api.messages.sendMessage);
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const sendReaction = useMutation(api.reactions.sendReaction);
  const activePoll = useQuery(api.polls.getActivePoll, info ? { eventId: info.eventId } : "skip");
  const castVote = useMutation(api.polls.castVote);

  const flights = useReactionFlights(reactions ?? []);
  const {
    inputRef,
    suggestions,
    highlighted,
    insertAtCaret,
    acceptSuggestion,
    handleChange,
    handleKeyDown,
    closeSuggestions,
  } = useEmojiComposer(content, setContent);
  useDismissablePopover(composerWrapRef, suggestions.length > 0, closeSuggestions);

  // Jump straight to the most recent messages on open, and keep sticking to
  // the bottom as new ones arrive — unless the participant has scrolled up
  // to read history, in which case an incoming message shouldn't yank them
  // back down.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !messages) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (!hasScrolledToLatest.current || nearBottom) {
      el.scrollTop = el.scrollHeight;
      hasScrolledToLatest.current = true;
    }
  }, [messages]);

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
    return <EventNotFound code={joinSlug} />;
  }
  if (info.status === "ended") {
    return <main><EmptyState>This event has ended.</EmptyState></main>;
  }
  if (participantStatus?.kicked) {
    return <ParticipantRemoved />;
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

  async function handleReact(emoji: string) {
    try {
      await sendReaction({
        eventId: info!.eventId,
        participantId: participant!.participantId as Id<"participants">,
        emoji,
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes("RateLimited")) {
        setReactionError("Easy on the reactions — try again in a moment.");
        setTimeout(() => setReactionError(null), 2500);
      }
    }
  }

  return (
    <main className={`shell chat${activePoll ? " chat--poll" : ""}`}>
      <FlyingReactions flights={flights} />
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
      <div className="chat__scroll" ref={scrollRef}>
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

        <div className="chat__quick-actions" role="group" aria-label="Quick actions">
          <ReactionBar onReact={handleReact} />
          {reactionError && <span className="reaction-error" role="status">{reactionError}</span>}
        </div>

        <div className="composer-wrap" ref={composerWrapRef}>
          {suggestions.length > 0 && (
            <ul
              className="emoji-suggestions"
              role="listbox"
              id="emoji-suggestions"
              aria-label="Emoji suggestions"
            >
              {suggestions.map((entry, index) => (
                <li
                  key={entry.slug}
                  id={`emoji-suggestion-${index}`}
                  role="option"
                  aria-selected={index === highlighted}
                  className={`emoji-suggestions__item${
                    index === highlighted ? " emoji-suggestions__item--active" : ""
                  }`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    acceptSuggestion(entry);
                  }}
                >
                  <span aria-hidden="true">{entry.emoji}</span>
                  <span className="emoji-suggestions__slug">:{entry.slug}:</span>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleSubmit} className="composer">
            <label htmlFor="composer" className="visually-hidden">
              Type a message
            </label>
            <div className="composer__input-wrap">
              <input
                id="composer"
                ref={inputRef}
                value={content}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message…"
                autoComplete="off"
                role="combobox"
                aria-expanded={suggestions.length > 0}
                aria-controls="emoji-suggestions"
                aria-autocomplete="list"
                aria-activedescendant={suggestions.length > 0 ? `emoji-suggestion-${highlighted}` : undefined}
              />
              <EmojiPicker onSelect={insertAtCaret} />
            </div>
            <Button type="submit" className="composer__send">
              Send
            </Button>
          </form>
        </div>
        {error && (
          <p role="alert" className="alert" style={{ marginTop: "0.5rem" }}>
            {error}
          </p>
        )}
      </footer>
    </main>
  );
}
