import { useState, type FormEvent } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useQuery, useMutation, api } from "../../lib/convexClient";
import { getStoredParticipant, storeParticipant } from "../../lib/participant";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";

export function JoinPage() {
  const { joinSlug } = useParams<{ joinSlug: string }>();
  const navigate = useNavigate();
  const info = useQuery(api.events.getJoinInfo, joinSlug ? { joinSlug } : "skip");
  const joinEvent = useMutation(api.participants.joinEvent);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = displayName.trim();
    if (trimmed.length === 0) {
      setError("Please enter a display name.");
      return;
    }
    try {
      const { participantId } = await joinEvent({ eventId: info!.eventId, displayName: trimmed });
      storeParticipant(joinSlug!, { participantId, displayName: trimmed });
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
    content = <EmptyState>We couldn't find this event. Check the link and try again.</EmptyState>;
  } else if (info.status === "ended") {
    content = <EmptyState>This event has ended.</EmptyState>;
  } else if (getStoredParticipant(joinSlug)) {
    return <Navigate to={`/chat/${joinSlug}`} replace />;
  } else {
    showBlobs = true;
    content = (
      <form onSubmit={handleSubmit} style={{ display: "contents" }}>
        <div style={{ marginTop: "auto", paddingTop: "8rem", position: "relative" }}>
          <p className="mono-label" style={{ margin: "0 0 0.5rem", color: "var(--muted)" }}>
            You're joining
          </p>
          <h1 className="join__title">{info.name}</h1>
          <p style={{ margin: "0.9rem 0 0", color: "#4a4339", maxWidth: 300 }}>
            Chat with the room and everyone watching remotely. No account, no app.
          </p>
        </div>
        <div className="stack" style={{ marginTop: "2.5rem", position: "relative" }}>
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
    <main className="shell join">
      {showBlobs && (
        <>
          <span className="join__blob" aria-hidden="true" style={{ right: -90, top: -90, width: 300, height: 300, background: "var(--live)" }} />
          <span className="join__blob" aria-hidden="true" style={{ right: 60, top: 150, width: 90, height: 90, background: "var(--poll)" }} />
        </>
      )}
      {content}
    </main>
  );
}
