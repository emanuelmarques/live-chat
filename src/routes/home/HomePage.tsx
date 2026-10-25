import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";

/**
 * Public landing page — the fallback for someone who can't scan the event's
 * QR code. They type the short event code shown by the moderator instead.
 */
export function HomePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Strip stray whitespace defensively; getJoinInfo normalizes case server-side,
    // so this works regardless of how the person typed it.
    const trimmed = code.replace(/\s+/g, "");
    if (!trimmed) return;
    navigate(`/join/${encodeURIComponent(trimmed)}`);
  }

  return (
    <main className="home">
      <form onSubmit={handleSubmit} className="stack">
        <h1 style={{ margin: 0 }}>Join an event</h1>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Enter the event code shown by the moderator — handy if you can't scan the QR code.
        </p>
        <TextField
          label="Event code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="code-input"
          autoFocus
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          required
        />
        <Button type="submit">Join</Button>
      </form>
    </main>
  );
}
