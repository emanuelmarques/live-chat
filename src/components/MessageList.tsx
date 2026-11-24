import { MessageReactions } from "./MessageReactions";
import { reactionKey, type ReactionsByMessage } from "../lib/useMessageReactions";

export interface MessageRow {
  messageId: string;
  authorKey: string;
  authorDisplayName: string;
  content: string;
  replyTo: { messageId: string; deleted: boolean; authorDisplayName?: string; content?: string } | null;
  sentAt: number;
}

interface MessageListProps {
  messages: MessageRow[];
  currentAuthorKey?: string;
  /** Reaction counts per message id (see `useMessageReactions`). */
  reactions?: ReactionsByMessage;
  /** `reactionKey(messageId, emoji)` of the viewer's own reactions. */
  myReactions?: ReadonlySet<string>;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
  onReply?: (message: MessageRow) => void;
  /** Moderator mode: show Delete on every message, not only the viewer's own. */
  canDeleteAny?: boolean;
  /** Moderator mode: pin/unpin a message on the projector. */
  onToggleHighlight?: (message: MessageRow) => void;
  highlightedMessageId?: string | null;
}

const AVATAR_COLORS = ["#f4b73f", "#9cd6b8", "#e8a0c0", "#a9b8ff", "#f3eee3", "#ffb38a"];

function avatarColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageList({
  messages,
  currentAuthorKey,
  reactions,
  myReactions,
  onToggleReaction,
  onDelete,
  onReply,
  canDeleteAny,
  onToggleHighlight,
  highlightedMessageId,
}: MessageListProps) {
  return (
    <ul className="msgs" aria-live="polite" aria-relevant="additions">
      {messages.map((message) => {
        const isOwn = message.authorKey === currentAuthorKey;
        const isHighlighted = message.messageId === highlightedMessageId;
        const canDelete = onDelete && (isOwn || canDeleteAny);
        return (
          <li
            key={message.messageId}
            data-message-id={message.messageId}
            className={`msg${isOwn ? " msg--own" : ""}${isHighlighted ? " msg--highlighted" : ""}`}
          >
            <span
              aria-hidden="true"
              className="avatar"
              style={{ background: avatarColor(message.authorDisplayName) }}
            >
              {message.authorDisplayName.charAt(0).toUpperCase()}
            </span>
            <div className="msg__body">
              <div className="msg__meta">
                <strong className="msg__name">{message.authorDisplayName}</strong> · {formatTime(message.sentAt)}
                {isHighlighted && <span className="msg__pin"> · ★ On projector</span>}
              </div>
              <div className="bubble">
                {message.replyTo && (
                  <div className="quote">
                    {message.replyTo.deleted
                      ? "Replying to a deleted message"
                      : `Replying to ${message.replyTo.authorDisplayName}: ${message.replyTo.content}`}
                  </div>
                )}
                <span>{message.content}</span>
              </div>
              <MessageReactions
                reactions={(reactions?.[message.messageId] ?? []).map((r) => ({
                  ...r,
                  mine: myReactions?.has(reactionKey(message.messageId, r.emoji)) ?? false,
                }))}
                onToggle={onToggleReaction ? (emoji) => onToggleReaction(message.messageId, emoji) : undefined}
              />
              {(onReply || onToggleHighlight || canDelete) && (
                <div className="msg__actions">
                  {onReply && (
                    <button type="button" onClick={() => onReply(message)}>
                      Reply
                    </button>
                  )}
                  {onToggleHighlight && (
                    <button type="button" aria-pressed={isHighlighted} onClick={() => onToggleHighlight(message)}>
                      {isHighlighted ? "Remove highlight" : "Highlight"}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        // The moderator view already asks its own confirmation.
                        if (canDeleteAny || window.confirm("Delete this message? This can't be undone.")) {
                          onDelete(message.messageId);
                        }
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
