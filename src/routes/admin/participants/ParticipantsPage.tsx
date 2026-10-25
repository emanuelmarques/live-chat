import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, api, type Id } from "../../../lib/convexClient";
import { getStoredSessionToken } from "../../../lib/session";
import { EmptyState } from "../../../components/EmptyState";
import { TextField } from "../../../components/TextField";

const AVATAR_COLORS = ["#f4b73f", "#9cd6b8", "#e8a0c0", "#a9b8ff", "#f3eee3", "#ffb38a"];

function avatarColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

export function ParticipantsPage() {
  const { eventId: eventIdParam } = useParams<{ eventId: string }>();
  const eventId = eventIdParam as Id<"events">;
  const sessionToken = getStoredSessionToken() ?? "";
  const participants = useQuery(api.participants.listParticipants, { sessionToken, eventId });
  const [filter, setFilter] = useState("");

  if (!eventIdParam) {
    return null;
  }

  const visible = participants?.filter((p) =>
    p.displayName.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <div className="stack" style={{ maxWidth: 640, gap: "1rem" }}>
      <h1 style={{ margin: 0 }}>Participants</h1>
      {participants === undefined && <p role="status">Loading…</p>}
      {participants && participants.length === 0 && (
        <EmptyState>Nobody has joined yet.</EmptyState>
      )}
      {participants && participants.length > 0 && (
        <>
          <p style={{ margin: 0 }} role="status">
            <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem" }}>
              {participants.length}
            </strong>{" "}
            joined
          </p>
          <TextField
            label="Filter by name"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {visible && visible.length === 0 && <EmptyState>No one matches that name.</EmptyState>}
          <ul className="list" style={{ gap: "0.5rem" }}>
            {visible?.map((p) => (
              <li
                key={p.participantId}
                className="card"
                style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0.9rem" }}
              >
                <span
                  aria-hidden="true"
                  className="avatar"
                  style={{ background: avatarColor(p.displayName) }}
                >
                  {p.displayName.charAt(0).toUpperCase()}
                </span>
                <span style={{ flex: 1, fontWeight: 600, overflowWrap: "anywhere" }}>
                  {p.displayName}
                </span>
                <span className="mono-label" style={{ color: "var(--muted)", textTransform: "none" }}>
                  joined{" "}
                  {new Date(p.joinedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
