import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { RouteGuard } from "./RouteGuard";
import { useQuery, useMutation, api, type Id } from "../../lib/convexClient";
import { clearSessionToken, getStoredSessionToken } from "../../lib/session";

const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : undefined);

function EventNav({ eventId }: { eventId: Id<"events"> }) {
  const sessionToken = getStoredSessionToken() ?? "";
  const event = useQuery(api.events.getEvent, { eventId });
  const pending = useQuery(api.moderation.listPending, { sessionToken, eventId });
  const activePoll = useQuery(api.polls.getActivePoll, { eventId });
  const participantCount = useQuery(api.participants.countParticipants, { eventId });
  const endEvent = useMutation(api.events.endEvent);

  const live = event?.status === "active";
  const pendingCount = pending?.length ?? 0;
  const pollLive = Boolean(activePoll && activePoll.isActive);

  async function handleEnd() {
    if (!window.confirm("End this event? Nobody will be able to join or post afterwards.")) return;
    await endEvent({ sessionToken, eventId });
  }

  return (
    <>
      <div className="admin__event">
        <div className="mono-label" style={{ color: live ? "#ff8a5e" : "#a39a8b" }}>
          {event ? (live ? "● Live" : "Ended") : "…"}
        </div>
        <div className="admin__event-name">{event?.name ?? "Loading…"}</div>
      </div>

      <NavLink to={`/admin/events/${eventId}/moderation`} className={linkClass}>
        Moderation
        {pendingCount > 0 && (
          <span className="badge" aria-label={`${pendingCount} messages waiting`}>
            {pendingCount}
          </span>
        )}
      </NavLink>
      <NavLink to={`/admin/events/${eventId}/polls`} className={linkClass}>
        Polls
        {pollLive && (
          <span className="badge badge--poll" aria-label="A poll is active">
            live
          </span>
        )}
      </NavLink>
      <NavLink to={`/admin/events/${eventId}/participants`} className={linkClass}>
        Participants
        {participantCount !== undefined && participantCount > 0 && (
          <span className="badge badge--quiet" aria-label={`${participantCount} joined`}>
            {participantCount}
          </span>
        )}
      </NavLink>
      <NavLink to={`/admin/events/${eventId}/export`} className={linkClass}>
        Export
      </NavLink>

      {event && (
        <div className="admin__tools">
          <a href={`/projector/${event.joinSlug}`} target="_blank" rel="noreferrer">
            Open projector ↗
          </a>
          <a href={`/join/${event.joinSlug}`} target="_blank" rel="noreferrer">
            Open join page ↗
          </a>
          {live && (
            <button type="button" className="admin__end" onClick={handleEnd}>
              End event
            </button>
          )}
        </div>
      )}
    </>
  );
}

export function AdminLayout() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  function handleLogout() {
    clearSessionToken();
    navigate("/admin/login", { replace: true });
  }

  return (
    <RouteGuard>
      <div className="admin">
        <nav aria-label="Moderator panel" className="admin__nav">
          <div className="admin__brand">
            <span className="live-dot" style={{ width: 14, height: 14 }} aria-hidden="true" />
            liveroom
          </div>
          <NavLink to="/admin/events" end className={linkClass}>
            All events
          </NavLink>
          {eventId && <EventNav eventId={eventId as Id<"events">} />}
          <button type="button" className="admin__logout" onClick={handleLogout}>
            Log out
          </button>
        </nav>
        <main className="admin__main">
          <Outlet />
        </main>
      </div>
    </RouteGuard>
  );
}
