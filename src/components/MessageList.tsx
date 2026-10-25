export interface MessageRow {
  messageId: string;
  participantId: string;
  authorDisplayName: string;
  content: string;
  replyTo: { messageId: string; deleted: boolean; authorDisplayName?: string; content?: string } | null;
  sentAt: number;
}

interface MessageListProps {
  messages: MessageRow[];
  currentParticipantId?: string;
  onDelete?: (messageId: string) => void;
  onReply?: (message: MessageRow) => void;
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

export function MessageList({ messages, currentParticipantId, onDelete, onReply }: MessageListProps) {
  return (
    <ul className="msgs" aria-live="polite" aria-relevant="additions">
      {messages.map((message) => {
        const isOwn = message.participantId === currentParticipantId;
        return (
          <li key={message.messageId} className={`msg${isOwn ? " msg--own" : ""}`}>
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
              {(onReply || (onDelete && isOwn)) && (
                <div className="msg__actions">
                  {onReply && (
                    <button type="button" onClick={() => onReply(message)}>
                      Reply
                    </button>
                  )}
                  {onDelete && isOwn && (
                    <button type="button" className="danger" onClick={() => onDelete(message.messageId)}>
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
