import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, api } from "../../lib/convexClient";
import { MessageList } from "../../components/MessageList";
import { PollBanner } from "../../components/PollBanner";
import { EmptyState } from "../../components/EmptyState";
import { EventNotFound } from "../../components/EventNotFound";
import { QrCode } from "../../components/QrCode";

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
    return <EventNotFound code={joinSlug} />;
  }

  const joinUrl = `${window.location.origin}/join/${joinSlug}`;

  return (
    <div
      className={`projector${activePoll && activePoll.isActive ? " projector--poll" : ""}`}
      data-theme={theme}
    >
      <button type="button" className="theme-toggle" onClick={toggleTheme}>
        {theme === "dark" ? "☀ Light mode" : "☾ Dark mode"}
      </button>
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
