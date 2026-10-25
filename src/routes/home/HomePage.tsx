import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

/** Shows the code in groups of 3 ("ABC 234") — the same way the projector does. */
function groupCode(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/(.{3})(?=.)/g, "$1 ");
}

/**
 * Public landing page — where people type the short event code shown on the
 * projector (the fallback for anyone who can't scan the QR code), plus the way
 * in to the moderator panel.
 */
export function HomePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setCode(groupCode(event.target.value));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Strip the grouping spaces; getJoinInfo normalizes case server-side.
    const trimmed = code.replace(/\s+/g, "");
    if (!trimmed) return;
    navigate(`/join/${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="landing">
      <span className="landing__blob landing__blob--a" aria-hidden="true" />
      <span className="landing__blob landing__blob--b" aria-hidden="true" />

      <header className="landing__bar">
        <div className="landing__brand">
          <span className="live-dot" style={{ width: 14, height: 14 }} aria-hidden="true" />
          liveroom
        </div>
        <Link to="/admin/login" className="landing__admin">
          Moderator login
        </Link>
      </header>

      <main className="landing__main">
        <p className="mono-label landing__eyebrow">Live chat for in-person &amp; remote events</p>
        <h1 className="landing__title">Join an event</h1>
        <p className="landing__lede">
          Enter the code you see on the screen. No account, no app — just your name.
        </p>

        <form onSubmit={handleSubmit} className="landing__form">
          <label htmlFor="event-code" className="visually-hidden">
            Event code
          </label>
          <input
            id="event-code"
            className="landing__code"
            value={code}
            onChange={handleChange}
            placeholder="J23 9JK"
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            required
          />
          <button type="submit" className="btn btn--primary landing__go">
            Join
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>

        <p className="landing__hint">Can't see a code? Scan the QR code on the screen with your camera instead.</p>
      </main>
    </div>
  );
}
