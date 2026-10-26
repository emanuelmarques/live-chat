/** Full-page state shown to a participant the moderator has kicked from the event. */
export function ParticipantRemoved() {
  return (
    <main className="shell removed">
      <span className="removed__mark" aria-hidden="true">
        ✕
      </span>
      <h1 className="removed__title" role="status">
        You've been removed
      </h1>
      <p className="removed__lede">
        The moderator removed you from this event. You can no longer send messages, react, or
        vote here.
      </p>
    </main>
  );
}
