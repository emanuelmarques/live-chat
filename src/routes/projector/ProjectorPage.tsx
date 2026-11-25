import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, api } from "../../lib/convexClient";
import { useReactionFlights } from "../../lib/useReactionFlights";
import { usePagedMessages } from "../../lib/usePagedMessages";
import { useMessageReactions } from "../../lib/useMessageReactions";
import { useActiveParticipantCount } from "../../lib/usePresence";
import { MessageList } from "../../components/MessageList";
import { PollBanner } from "../../components/PollBanner";
import { EmptyState } from "../../components/EmptyState";
import { EventNotFound } from "../../components/EventNotFound";
import { QrCode } from "../../components/QrCode";
import { FlyingReactions } from "../../components/FlyingReactions";

type Theme = "dark" | "light";
const THEME_STORAGE_KEY = "liveChat.projectorTheme";

function readInitialTheme(): Theme {
  const fromUrl = new URLSearchParams(window.location.search).get("theme");
  if (fromUrl === "light" || fromUrl === "dark") return fromUrl;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage unavailable — fall back to the default.
  }
  return "dark";
}

export function ProjectorPage() {
  const { joinSlug } = useParams<{ joinSlug: string }>();
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore: the choice just won't persist across reloads.
    }
  }

  const info = useQuery(api.events.getJoinInfo, joinSlug ? { joinSlug } : "skip");
  // Only the newest page: the projector shows the tail of the conversation.
  const { messages } = usePagedMessages(info?.eventId);
  const { reactions: messageReactions } = useMessageReactions(info?.eventId, messages?.[0]?.sentAt);
  const highlighted = useQuery(
    api.messages.getHighlightedMessage,
    info ? { eventId: info.eventId } : "skip",
  );
  const reactions = useQuery(api.reactions.listRecentReactions, info ? { eventId: info.eventId } : "skip");
  const activePoll = useQuery(api.polls.getActivePoll, info ? { eventId: info.eventId } : "skip");
  const participantCount = useActiveParticipantCount(info?.eventId);
  const flights = useReactionFlights(reactions ?? []);

  if (!joinSlug) {
    return <EmptyState>Invalid link.</EmptyState>;
  }
  // Check `info === null` first: `messages` is skipped (stays undefined) for an unknown event.
  if (info === null) {
    return <EventNotFound code={joinSlug} />;
  }
  if (info === undefined || messages === undefined) {
    return <p role="status">Loading…</p>;
  }

  const joinUrl = `${window.location.origin}/join/${joinSlug}`;
  const pollActive = !!(activePoll && activePoll.isActive);
  // Nothing to show yet: make the join QR code the centrepiece.
  const showWelcome = info.status !== "ended" && messages.length === 0 && !highlighted && !pollActive;

  return (
    <div
      className={`projector${pollActive ? " projector--poll" : ""}${showWelcome ? " projector--welcome" : ""}`}
      data-theme={theme}
    >
      <FlyingReactions flights={flights} />
      <button type="button" className="theme-toggle" onClick={toggleTheme}>
        {theme === "dark" ? "☀ Light mode" : "☾ Dark mode"}
      </button>
      <section className="projector__chat">
        <header className="projector__head">
          <h1 title={info.name} data-long={info.name.length > 40}>
            {info.name}
          </h1>
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
        ) : showWelcome ? (
          <section className="welcome" aria-label="How to join">
            <div className="welcome__qr">
              <QrCode value={joinUrl} size={900} />
            </div>
            <div className="welcome__text">
              <p className="welcome__scan">Scan to join the chat</p>
              <p className="welcome__or mono-label">or go to</p>
              <p className="welcome__host">{window.location.host}</p>
              <p className="welcome__or mono-label">and enter the code</p>
              <p className="welcome__code" aria-label={`Event code ${joinSlug.split("").join(" ")}`}>
                {joinSlug.toUpperCase().replace(/(.{3})(?=.)/g, "$1 ")}
              </p>
            </div>
          </section>
        ) : (
          <>
          {highlighted && (
            <section className="projector__highlight" aria-label="Discussion topic">
              <p className="projector__highlight-label mono-label">Discussion topic</p>
              <p className="projector__highlight-text">{highlighted.content}</p>
              <p className="projector__highlight-author">— {highlighted.authorDisplayName}</p>
            </section>
          )}
          <div className="projector__feed">
            <MessageList messages={messages} reactions={messageReactions} />
          </div>
          </>
        )}
      </section>

      {info.status !== "ended" && !showWelcome && (
        <aside className="projector__side">
          {activePoll && activePoll.isActive && <PollBanner poll={activePoll} />}
          <section className="join-card" aria-label="How to join">
            <div className="join-card__qr">
              <QrCode value={joinUrl} size={480} />
            </div>
            <p className="join-card__scan">Scan to join</p>
            <div className="join-card__divider">
              <span>or</span>
            </div>
            <ol className="join-steps">
              <li>
                <span className="join-steps__label">Go to</span>
                <span className="join-steps__host">{window.location.host}</span>
              </li>
              <li>
                <span className="join-steps__label">and enter the code</span>
                <span className="join-steps__code" aria-label={`Event code ${joinSlug.split("").join(" ")}`}>
                  {joinSlug.toUpperCase().replace(/(.{3})(?=.)/g, "$1 ")}
                </span>
              </li>
            </ol>
          </section>
        </aside>
      )}
    </div>
  );
}
