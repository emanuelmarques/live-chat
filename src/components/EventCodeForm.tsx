import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { groupCode } from "../lib/joinCode";

/** Code input + Join button: sends the person to /join/<code>. */
export function EventCodeForm({ autoFocus = false }: { autoFocus?: boolean }) {
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
        autoFocus={autoFocus}
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
  );
}
