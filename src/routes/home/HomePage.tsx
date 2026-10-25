import { Link } from "react-router-dom";
import { EventCodeForm } from "../../components/EventCodeForm";

/**
 * Public landing page — where people type the short event code shown on the
 * projector (the fallback for anyone who can't scan the QR code), plus the way
 * in to the moderator panel.
 */
export function HomePage() {
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

        <EventCodeForm autoFocus />

        <p className="landing__hint">Can't see a code? Scan the QR code on the screen with your camera instead.</p>
      </main>
    </div>
  );
}
