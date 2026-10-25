import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, api, type Id } from "../../../lib/convexClient";
import { getStoredSessionToken } from "../../../lib/session";
import { TextField } from "../../../components/TextField";
import { Button } from "../../../components/Button";
import { EmptyState } from "../../../components/EmptyState";
import { QrCode } from "../../../components/QrCode";

function LinkRow({ label, hint, path }: { label: string; hint: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable (insecure context) — the link stays selectable and openable.
    }
  }

  return (
    <div className="link-row">
      <div className="link-row__text">
        <span className="link-row__label">
          {label} <span style={{ fontWeight: 400, color: "var(--muted)" }}>· {hint}</span>
        </span>
        <a href={path} target="_blank" rel="noreferrer" className="link-row__url">
          {url.replace(/^https?:\/\//, "")}
        </a>
      </div>
      <button
        type="button"
        className="btn btn--secondary"
        onClick={copy}
        aria-label={`Copy ${label.toLowerCase()}`}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
      <a className="btn btn--dark" href={path} target="_blank" rel="noreferrer">
        Open ↗
      </a>
    </div>
  );
}

export function EventsPage() {
  const sessionToken = getStoredSessionToken() ?? "";
  const events = useQuery(api.events.listEvents, { sessionToken });
  const createEvent = useMutation(api.events.createEvent);
  const [name, setName] = useState("");
  const [expandedEventId, setExpandedEventId] = useState<Id<"events"> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  // A ref (not state) so the guard is synchronous even if two submit events fire
  // in the same tick, before a re-render could update `isCreating`.
  const isCreatingRef = useRef(false);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (isCreatingRef.current) return; // guards against a double Enter/click submitting twice
    const trimmed = name.trim();
    if (!trimmed) return;
    isCreatingRef.current = true;
    setIsCreating(true);
    try {
      const { eventId } = await createEvent({ sessionToken, name: trimmed });
      setName("");
      setExpandedEventId(eventId);
    } finally {
      isCreatingRef.current = false;
      setIsCreating(false);
    }
  }

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <h1 style={{ margin: 0 }}>Events</h1>
      <form
        onSubmit={handleCreate}
        className="card card--lift"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}
      >
        <div style={{ flex: "1 1 260px" }}>
          <TextField
            label="New event name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={isCreating}>
          Create event
        </Button>
      </form>

      {events === undefined && <p role="status">Loading…</p>}
      {events && events.length === 0 && <EmptyState>No events yet — create one above.</EmptyState>}
      {events && events.length > 0 && (
        <ul className="list">
          {[...events]
            .sort((a, b) => Number(b.status === "active") - Number(a.status === "active"))
            .map((event) => {
              const expanded = expandedEventId === event.eventId;
              const live = event.status === "active";
              return (
                <li key={event.eventId} className="card">
                  <div className="row" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
                    <strong
                      style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: "1.2rem" }}
                    >
                      {event.name}
                    </strong>
                    <span
                      className="mono-label"
                      style={{ color: live ? "var(--live-text)" : "var(--muted)" }}
                    >
                      {live ? "● Live" : "Ended"}
                    </span>
                    <Link
                      className="btn btn--dark"
                      to={`/admin/events/${event.eventId}/moderation`}
                    >
                      Manage
                    </Link>
                  </div>
                  <div className="links">
                    <LinkRow
                      label="Join link"
                      hint="for participants"
                      path={`/join/${event.joinSlug}`}
                    />
                    <LinkRow
                      label="Projector link"
                      hint="for the room screen"
                      path={`/projector/${event.joinSlug}`}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    aria-expanded={expanded}
                    onClick={() => setExpandedEventId(expanded ? null : event.eventId)}
                  >
                    {expanded ? "Hide" : "Show"} QR code
                  </button>
                  {expanded && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <QrCode
                        value={`${window.location.origin}/join/${event.joinSlug}`}
                        size={200}
                      />
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
