import { useEffect, useState, type FormEvent } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useQuery, useMutation, api } from "../../lib/convexClient";
import { getStoredParticipant, joinOncePerBrowser, participantStorageKey } from "../../lib/participant";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { EventNotFound } from "../../components/EventNotFound";

export function JoinPage() {
  const { joinSlug } = useParams<{ joinSlug: string }>();
  const navigate = useNavigate();
  const info = useQuery(api.events.getJoinInfo, joinSlug ? { joinSlug } : "skip");
  const joinEvent = useMutation(api.participants.joinEvent);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Bumped when another tab (same browser) finishes joining this event, so
  // this tab re-reads localStorage and redirects instead of letting someone
  // join a second time from a second tab (see `joinOncePerBrowser`).
  const [, forceRecheck] = useState(0);

  useEffect(() => {
    if (!joinSlug) return;
    const key = participantStorageKey(joinSlug);
    function onStorage(event: StorageEvent) {
      if (event.key === key) forceRecheck((n) => n + 1);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [joinSlug]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = displayName.trim();
    if (trimmed.length === 0) {
      setError("Please enter a display name.");
      return;
    }
    try {
      await joinOncePerBrowser(joinSlug!, async () => {
        const { participantId } = await joinEvent({ eventId: info!.eventId, displayName: trimmed });
        return { participantId, displayName: trimmed };
      });
      navigate(`/chat/${joinSlug}`, { replace: true });
    } catch {
      setError("Couldn't join right now. Please try again.");
    }
  }

  let content: React.ReactNode;
  let showBlobs = false;
  if (!joinSlug) {
    content = <EmptyState>Invalid link.</EmptyState>;
  } else if (info === undefined) {
    content = <p role="status">Loading…</p>;
  } else if (info === null) {
    return <EventNotFound code={joinSlug} />;
  } else if (info.status === "ended") {
    content = <EmptyState>This event has ended.</EmptyState>;
  } else if (getStoredParticipant(joinSlug)) {
    return <Navigate to={`/chat/${joinSlug}`} replace />;
  } else {
    showBlobs = true;
    content = (
      <form onSubmit={handleSubmit} style={{ display: "contents" }}>
        <div className="join__hero">
          <p className="mono-label" style={{ margin: "0 0 0.5rem", color: "var(--muted)" }}>
            You're joining
          </p>
          <h1 className="join__title">{info.name}</h1>
          <p className="join__lede">
            Chat with the room and everyone watching remotely. No account, no app.
          </p>
        </div>
        <div className="stack join__form">
          <TextField
            label="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            autoFocus
          />
          {error && (
            <p role="alert" className="alert">
              {error}
            </p>
          )}
          <Button type="submit" style={{ minHeight: 56, fontSize: "1.1rem" }}>
            Join chat
          </Button>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)", textAlign: "center" }}>
            Messages with flagged terms wait for the moderator's approval.
          </p>
        </div>
      </form>
    );
  }

  return (
    <main className={`shell join${showBlobs ? " join--form" : ""}`}>
      {showBlobs && (
        <>
          <span className="join__blob join__blob--a" aria-hidden="true" />
          <span className="join__blob join__blob--b" aria-hidden="true" />
        </>
      )}
      {content}
    </main>
  );
}
