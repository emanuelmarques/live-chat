import { Link } from "react-router-dom";
import { EventCodeForm } from "./EventCodeForm";
import { groupCode } from "../lib/joinCode";

/** Full-page "no such event" state, with a way to try another code. */
export function EventNotFound({ code }: { code?: string }) {
  const shown = code ? groupCode(decodeURIComponent(code)).toUpperCase() : null;
  return (
    <div className="landing notfound">
      <span className="landing__blob landing__blob--a" aria-hidden="true" />
      <span className="landing__blob landing__blob--b" aria-hidden="true" />

      <header className="landing__bar">
        <Link to="/" className="landing__brand" style={{ textDecoration: "none" }}>
          <span className="live-dot" style={{ width: 14, height: 14 }} aria-hidden="true" />
          liveroom
        </Link>
      </header>

      <main className="landing__main">
        <div className="notfound__mark" aria-hidden="true">
          ?
        </div>
        <h1 className="landing__title notfound__title" role="status">
          We couldn't find this event
        </h1>
        <p className="landing__lede">
          {shown ? (
            <>
              No event matches <span className="notfound__code">{shown}</span>.{" "}
            </>
          ) : null}
          Check the code on the screen and try again — or scan the QR code instead.
        </p>

        <EventCodeForm autoFocus />

        <p className="landing__hint">
          <Link to="/">Back to the start</Link>
        </p>
      </main>
    </div>
  );
}
