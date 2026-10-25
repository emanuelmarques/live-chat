import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, api, type Id } from "../../../lib/convexClient";
import { getStoredSessionToken } from "../../../lib/session";
import { Button } from "../../../components/Button";
import { TextField } from "../../../components/TextField";
import { EmptyState } from "../../../components/EmptyState";

export function ModerationPage() {
  const { eventId: eventIdParam } = useParams<{ eventId: string }>();
  const eventId = eventIdParam as Id<"events">;
  const sessionToken = getStoredSessionToken() ?? "";

  const pending = useQuery(api.moderation.listPending, { sessionToken, eventId });
  const blockList = useQuery(api.moderation.listBlockListEntries, { sessionToken });
  const approve = useMutation(api.moderation.approveMessage);
  const reject = useMutation(api.moderation.rejectMessage);
  const addTerm = useMutation(api.moderation.addBlockListEntry);
  const removeTerm = useMutation(api.moderation.removeBlockListEntry);
  const [newTerm, setNewTerm] = useState("");

  if (!eventIdParam) {
    return <EmptyState>No event selected.</EmptyState>;
  }

  async function handleAddTerm(event: FormEvent) {
    event.preventDefault();
    const trimmed = newTerm.trim();
    if (!trimmed) return;
    await addTerm({ sessionToken, term: trimmed });
    setNewTerm("");
  }

  return (
    <div>
      <h1>Moderation</h1>
      <div className="admin__grid">
        <section style={{ flexBasis: 480, flexGrow: 3 }}>
          <h2>Held messages</h2>
          {pending === undefined && <p role="status">Loading…</p>}
          {pending && pending.length === 0 && <EmptyState>Nothing waiting for approval.</EmptyState>}
          {pending && pending.length > 0 && (
            <ul className="list">
              {pending.map((m) => (
                <li key={m.messageId} className="held">
                  <div className="mono-label" style={{ color: "var(--muted)", textTransform: "none" }}>
                    <strong style={{ color: "var(--ink)", fontWeight: 500 }}>{m.authorDisplayName}</strong>
                  </div>
                  <p className="held__text">{m.content}</p>
                  <div className="row">
                    <Button variant="dark" onClick={() => approve({ sessionToken, messageId: m.messageId })}>
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => reject({ sessionToken, messageId: m.messageId })}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" style={{ flexBasis: 320, flexGrow: 2 }}>
          <h2>Block-list</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", color: "var(--muted)" }}>
            Applies to new messages only. Any language.
          </p>
          <form onSubmit={handleAddTerm} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <TextField
                label="Add a term or phrase"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
              />
            </div>
            <Button type="submit" variant="dark">Add</Button>
          </form>
          {blockList === undefined && <p role="status">Loading…</p>}
          {blockList && blockList.length === 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              <EmptyState>No terms yet.</EmptyState>
            </div>
          )}
          {blockList && blockList.length > 0 && (
            <ul className="pill-list">
              {blockList.map((entry) => (
                <li key={entry.entryId} className="pill">
                  <span>{entry.term}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${entry.term}`}
                    onClick={() => removeTerm({ sessionToken, entryId: entry.entryId })}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
