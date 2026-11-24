import { useParams } from "react-router-dom";
import { useQuery, useMutation, api, type Id } from "../../../lib/convexClient";
import { getStoredSessionToken } from "../../../lib/session";
import { usePagedMessages } from "../../../lib/usePagedMessages";
import { useMessageReactions } from "../../../lib/useMessageReactions";
import { useChatScroll } from "../../../lib/useChatScroll";
import { MessageList, type MessageRow } from "../../../components/MessageList";
import { LoadOlderMessages } from "../../../components/LoadOlderMessages";
import { EmptyState } from "../../../components/EmptyState";

/**
 * Moderator's view of the participants' chat. Same look as the participant
 * chat (shared MessageList + styles), plus highlight and delete-any controls.
 */
export function ChatViewPage() {
  const { eventId: eventIdParam } = useParams<{ eventId: string }>();
  const eventId = eventIdParam as Id<"events">;
  const sessionToken = getStoredSessionToken() ?? "";

  const { messages, status, loadOlder } = usePagedMessages(eventIdParam ? eventId : undefined);
  const { reactions } = useMessageReactions(eventIdParam ? eventId : undefined, messages?.[0]?.sentAt);
  const highlighted = useQuery(api.messages.getHighlightedMessage, { eventId });
  const highlight = useMutation(api.moderation.highlightMessage);
  const clearHighlight = useMutation(api.moderation.clearHighlight);
  const remove = useMutation(api.moderation.deleteMessageAsModerator);

  // Same scrolling behaviour as the participant chat.
  const { scrollRef, topRef, onScroll } = useChatScroll(messages, status, loadOlder, reactions);

  if (!eventIdParam) {
    return <EmptyState>No event selected.</EmptyState>;
  }

  async function handleToggleHighlight(message: MessageRow) {
    if (highlighted?.messageId === message.messageId) {
      await clearHighlight({ sessionToken, eventId });
    } else {
      await highlight({ sessionToken, messageId: message.messageId as Id<"messages"> });
    }
  }

  async function handleDelete(messageId: string) {
    if (!window.confirm("Delete this message for everyone?")) return;
    await remove({ sessionToken, messageId: messageId as Id<"messages"> });
  }

  return (
    <div className="chat chat--admin">
      <h1>Chat</h1>
      <p className="chat--admin__hint">
        Highlight a message to pin it at the top of the projector as a discussion topic. Participants'
        chat is not affected.
      </p>
      {messages === undefined && <p role="status">Loading…</p>}
      {messages && messages.length === 0 && <EmptyState>No messages yet.</EmptyState>}
      {messages && messages.length > 0 && (
        <div className="chat__scroll" ref={scrollRef} onScroll={onScroll}>
          <LoadOlderMessages status={status} onLoad={loadOlder} sentinelRef={topRef} />
          <MessageList
            messages={messages}
            reactions={reactions}
            canDeleteAny
            onDelete={handleDelete}
            onToggleHighlight={handleToggleHighlight}
            highlightedMessageId={highlighted?.messageId ?? null}
          />
        </div>
      )}
    </div>
  );
}
