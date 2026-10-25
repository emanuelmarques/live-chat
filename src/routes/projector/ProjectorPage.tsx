import { useParams } from "react-router-dom";
import { useQuery, api } from "../../lib/convexClient";
import { MessageList } from "../../components/MessageList";
import { PollBanner } from "../../components/PollBanner";
import { EmptyState } from "../../components/EmptyState";
import { QrCode } from "../../components/QrCode";

export function ProjectorPage() {
  const { joinSlug } = useParams<{ joinSlug: string }>();
  const info = useQuery(api.events.getJoinInfo, joinSlug ? { joinSlug } : "skip");
  const messages = useQuery(api.messages.listMessages, info ? { eventId: info.eventId } : "skip");
  const activePoll = useQuery(api.polls.getActivePoll, info ? { eventId: info.eventId } : "skip");
  const participantCount = useQuery(
    api.participants.countParticipants,
    info ? { eventId: info.eventId } : "skip",
  );

  if (!joinSlug) {
    return <EmptyState>Invalid link.</EmptyState>;
  }
  if (info === undefined || messages === undefined) {
    return <p role="status">Loading…</p>;
  }
  if (info === null) {
    return <EmptyState>We couldn't find this event.</EmptyState>;
  }

  const joinUrl = `${window.location.origin}/join/${joinSlug}`;

  return (
    <div className="projector">
      <section className="projector__chat">
        <header className="projector__head">
          <h1>{info.name}</h1>
          {info.status !== "ended" && (
            <>
              <div className="projector__count" role="status">
                <strong>{participantCount ?? 0}</strong>
                <span>{participantCount === 1 ? "person in the chat" : "people in the chat"}</span>
              </div>
              <div className="projector__live mono-label" style={{ fontSize: "1.3rem" }}>
                <i aria-hidden="true" />
                Live
              </div>
            </>
          )}
        </header>
        {info.status === "ended" ? (
          <p style={{ fontSize: "2rem" }}>This event has ended.</p>
        ) : (
          <div className="projector__feed">
            <MessageList messages={messages} />
          </div>
        )}
      </section>

      {info.status !== "ended" && (
        <aside className="projector__side">
          {activePoll && activePoll.isActive && <PollBanner poll={activePoll} />}
          <section className="join-card" aria-label="Join">
            <QrCode value={joinUrl} size={200} />
            <div>
              <div className="mono-label" style={{ color: "var(--muted)" }}>
                Scan to join
              </div>
              <h2 className="join-card__title">Join the chat on your phone</h2>
              <div className="join-card__url">{joinUrl.replace(/^https?:\/\//, "")}</div>
            </div>
          </section>
        </aside>
      )}
    </div>
  );
}
