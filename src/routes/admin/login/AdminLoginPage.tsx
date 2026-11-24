import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, api } from "../../../lib/convexClient";
import { getStoredSessionToken, storeSessionToken } from "../../../lib/session";
import { TextField } from "../../../components/TextField";
import { Button } from "../../../components/Button";

export function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const login = useMutation(api.auth.login);

  if (getStoredSessionToken()) {
    return <Navigate to="/admin/events" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const result = await login({ email, password });
      if (!result.ok) {
        if (result.reason === "locked") {
          const minutes = Math.ceil(result.retryAfterSeconds / 60);
          setError(
            `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
          );
        } else {
          setError("Invalid email or password.");
        }
        return;
      }
      storeSessionToken(result.sessionToken);
      window.location.assign("/admin/events");
    } catch {
      setError("Couldn't log in right now. Please try again.");
    }
  }

  return (
    <main className="admin-login">
      <form onSubmit={handleSubmit} className="card card--lift stack" style={{ padding: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>Moderator login</h1>
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        {error && <p role="alert" className="alert">{error}</p>}
        <Button type="submit">Log in</Button>
      </form>
    </main>
  );
}
