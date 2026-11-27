import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, api, type Id } from "../../../lib/convexClient";
import { getStoredSessionToken } from "../../../lib/session";
import { TextField } from "../../../components/TextField";
import { Button } from "../../../components/Button";
import { EmptyState } from "../../../components/EmptyState";
import { QrCode } from "../../../components/QrCode";
import { MAX_EVENT_NAME_LENGTH } from "../../../lib/limits";

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

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable — the code is still visible to read/type by hand.
    }
  }

  return (
    <button type="button" className="btn btn--secondary" onClick={copy}>
      {copied ? "Copied ✓" : "Copy code"}
    </button>
  );
}

function ConfirmDeleteModal({
  eventName,
  onCancel,
  onConfirm,
}: {
  eventName: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } catch {
      setBusy(false); // on success the modal unmounts
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => !busy && onCancel()}>
      <div
        className="modal card card--lift"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-event-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="delete-event-title" style={{ margin: 0 }}>
          Delete this event?
        </h2>
        <p style={{ margin: 0 }}>
          <strong>{eventName}</strong> and all its messages, polls, votes and participants will be
          permanently deleted. This cannot be undone.
        </p>
        <div className="row" style={{ justifyContent: "flex-end", gap: "0.75rem" }}>
          <button
            ref={cancelRef}
            type="button"
            className="btn btn--secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <Button variant="danger" onClick={confirm} disabled={busy}>
            {busy ? "Deleting…" : "Delete permanently"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EventsPage() {
  const sessionToken = getStoredSessionToken() ?? "";
  const events = useQuery(api.events.listEvents, { sessionToken });
  const createEvent = useMutation(api.events.createEvent);
  const endEvent = useMutation(api.events.endEvent);
  const deleteEvent = useMutation(api.events.deleteEvent);
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ eventId: Id<"events">; name: string } | null>(
    null,
  );
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
      // Make sure the new event is visible: switch to Open and drop any filter.
      setTab("open");
      setSearch("");
      setExpandedEventId(eventId);
    } finally {
      isCreatingRef.current = false;
      setIsCreating(false);
    }
  }

  async function handleEnd(eventId: Id<"events">) {
    if (!window.confirm("End this event? Nobody will be able to join or post afterwards.")) return;
    await endEvent({ sessionToken, eventId });
  }

  const needle = search.trim().toLowerCase();
  const visibleEvents = (events ?? [])
    .filter((e) => (e.status === "active") === (tab === "open"))
    .filter(
      (e) =>
        !needle || e.name.toLowerCase().includes(needle) || e.joinSlug.toLowerCase().includes(needle),
    )
    .sort((a, b) =>
      tab === "open" ? b.createdAt - a.createdAt : (b.endedAt ?? 0) - (a.endedAt ?? 0),
    );

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
            maxLength={MAX_EVENT_NAME_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={isCreating}>
          Create event
        </Button>
      </form>

      <div className="events-toolbar">
        <div role="tablist" aria-label="Events" className="tabs">
          {(["open", "closed"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`tabs__tab${tab === t ? " tabs__tab--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "open" ? "Open" : "History"}
              {events &&
                ` (${events.filter((e) => (e.status === "active") === (t === "open")).length})`}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="events-search"
          aria-label={tab === "open" ? "Search open events" : "Search event history"}
          placeholder="Search by name or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {events === undefined && <p role="status">Loading…</p>}
      {events && visibleEvents.length === 0 && (
        <EmptyState>
          {needle
            ? "No events match your search."
            : tab === "open"
              ? "No open events — create one above."
              : "No ended events yet."}
        </EmptyState>
      )}
      {events && visibleEvents.length > 0 && (
        <ul className="list">
          {visibleEvents.map((event) => {
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
                    {live ? (
                      <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={() => handleEnd(event.eventId)}
                      >
                        End event
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => setPendingDelete({ eventId: event.eventId, name: event.name })}
                      >
                        Delete
                      </button>
                    )}
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
                    {expanded ? "Hide" : "Show"} QR &amp; code
                  </button>
                  {expanded && (
                    <div className="row" style={{ marginTop: "0.5rem", flexWrap: "wrap", alignItems: "flex-start" }}>
                      <QrCode
                        value={`${window.location.origin}/join/${event.joinSlug}`}
                        size={200}
                      />
                      <span className="mono-label" style={{ color: "var(--muted)", alignSelf: "center" }}>
                        Or
                      </span>
                      <div className="join-code-block">
                        <span className="mono-label" style={{ color: "var(--muted)" }}>
                          Go to {window.location.host} and enter this code
                        </span>
                        <span className="join-code">{event.joinSlug}</span>
                        <CopyCodeButton code={event.joinSlug} />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
      )}

      {pendingDelete && (
        <ConfirmDeleteModal
          eventName={pendingDelete.name}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            await deleteEvent({ sessionToken, eventId: pendingDelete.eventId });
            if (expandedEventId === pendingDelete.eventId) setExpandedEventId(null);
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}
