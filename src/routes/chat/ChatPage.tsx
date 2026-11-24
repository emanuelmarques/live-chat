import { useRef, useState, type FormEvent } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useQuery, useMutation, api, type Id } from "../../lib/convexClient";
import { getStoredParticipant } from "../../lib/participant";
import { hasVotedInPoll, markPollVoted } from "../../lib/pollVotes";
import { useEmojiComposer } from "../../lib/useEmojiComposer";
import { MAX_MESSAGE_LENGTH } from "../../lib/limits";
import { useReactionFlights } from "../../lib/useReactionFlights";
import { usePagedMessages } from "../../lib/usePagedMessages";
import { useMessageReactions } from "../../lib/useMessageReactions";
import { useChatScroll } from "../../lib/useChatScroll";
import { MessageList, type MessageRow } from "../../components/MessageList";
import { LoadOlderMessages } from "../../components/LoadOlderMessages";
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
  const [hiddenPollId, setHiddenPollId] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [, setVoteTick] = useState(0);
  const composerWrapRef = useRef<HTMLDivElement>(null);

  const info = useQuery(api.events.getJoinInfo, joinSlug ? { joinSlug } : "skip");
  const { messages, status: messagesStatus, loadOlder } = usePagedMessages(info?.eventId);
  const reactions = useQuery(api.reactions.listRecentReactions, info ? { eventId: info.eventId } : "skip");
  const participantForQuery = joinSlug ? getStoredParticipant(joinSlug) : null;
  const { reactions: messageReactions, myReactions } = useMessageReactions(
    info?.eventId,
    messages?.[0]?.sentAt,
    participantForQuery ? (participantForQuery.participantId as Id<"participants">) : undefined,
  );
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
  const toggleMessageReaction = useMutation(api.messageReactions.toggleMessageReaction);
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

  // Open at the newest message, follow new ones unless the participant scrolled
  // up to read history, and load older messages as they scroll to the top.
  const { scrollRef, topRef, onScroll } = useChatScroll(messages, messagesStatus, loadOlder, messageReactions);

  if (!joinSlug) {
    return <main><EmptyState>Invalid link.</EmptyState></main>;
  }
  const participant = getStoredParticipant(joinSlug);
  if (!participant) {
    return <Navigate to={`/join/${joinSlug}`} replace />;
  }
  // `info === null` must be checked before waiting on `messages`: that query is
  // skipped while the event is unknown, so it would stay undefined forever.
  if (info === null) {
    return <EventNotFound code={joinSlug} />;
  }
  if (info === undefined || messages === undefined) {
    return <main><p role="status">Loading…</p></main>;
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
    try {
      await deleteMessage({
        messageId: messageId as Id<"messages">,
        participantId: participant!.participantId as Id<"participants">,
      });
    } catch {
      setError("Couldn't delete that message. Please try again.");
    }
  }

  async function handleVote(optionIndex: number) {
    if (!activePoll) return;
    setVoteError(null);
    try {
      await castVote({
        pollId: activePoll.pollId as Id<"polls">,
        participantId: participant!.participantId as Id<"participants">,
        optionIndex,
      });
      markPollVoted(activePoll.pollId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("already voted")) {
        // Voted from another device/tab (or storage was cleared): sync the local flag.
        markPollVoted(activePoll.pollId);
      } else if (message.includes("no longer accepting")) {
        setVoteError("This poll just closed.");
      } else {
        setVoteError("Couldn't register your vote. Please try again.");
      }
    } finally {
      // The vote flag lives in localStorage, so force a re-render to show "You voted".
      setVoteTick((n) => n + 1);
    }
  }

  async function handleToggleMessageReaction(messageId: string, emoji: string) {
    try {
      await toggleMessageReaction({
        messageId: messageId as Id<"messages">,
        participantId: participant!.participantId as Id<"participants">,
        emoji,
      });
    } catch {
      // Message may have been deleted/rejected meanwhile; the live query will catch up.
    }
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

  const pollIsShowing = Boolean(activePoll?.isActive);

  return (
    <main className={`shell chat${pollIsShowing ? " chat--poll" : ""}`}>
      <FlyingReactions flights={flights} />
      <header className="chat__header">
        <div className="mono-label" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--live-text)" }}>
          <span className="live-dot" aria-hidden="true" />
          Live
          <span style={{ color: "var(--muted)", minWidth: 0, overflowWrap: "anywhere" }}>
            · you are {participant.displayName}
          </span>
        </div>
        <h1 className="chat__title">{info.name}</h1>
      </header>
      {activePoll && activePoll.isActive && (
        <div className="chat__poll">
          <button
            type="button"
            className="chat__poll-toggle"
            aria-expanded={hiddenPollId !== activePoll.pollId}
            aria-controls="chat-poll-banner"
            onClick={() =>
              setHiddenPollId((current) => (current === activePoll.pollId ? null : activePoll.pollId))
            }
          >
            {hiddenPollId === activePoll.pollId ? "Show poll" : "Hide poll · view chat"}
          </button>
          {hiddenPollId !== activePoll.pollId && (
            <div id="chat-poll-banner">
              <PollBanner
                poll={activePoll}
                onVote={handleVote}
                hasVoted={hasVotedInPoll(activePoll.pollId)}
              />
              {voteError && (
                <p role="alert" className="alert" style={{ marginTop: "0.5rem" }}>
                  {voteError}
                </p>
              )}
            </div>
          )}
        </div>
      )}
      <div className="chat__scroll" ref={scrollRef} onScroll={onScroll}>
        <LoadOlderMessages status={messagesStatus} onLoad={loadOlder} sentinelRef={topRef} />
        <MessageList
          messages={messages}
          currentAuthorKey={participantStatus?.authorKey}
          reactions={messageReactions}
          myReactions={myReactions}
          onToggleReaction={handleToggleMessageReaction}
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
                maxLength={MAX_MESSAGE_LENGTH}
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
