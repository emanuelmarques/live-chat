import { Navigate } from "react-router-dom";
import { useQuery, api } from "../../lib/convexClient";
import { clearSessionToken, getStoredSessionToken } from "../../lib/session";

/** Redirects to /admin/login unless a valid moderator session exists (FR-031). */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const sessionToken = getStoredSessionToken();
  const session = useQuery(
    api.auth.getSession,
    sessionToken ? { sessionToken } : "skip",
  );

  if (!sessionToken) {
    return <Navigate to="/admin/login" replace />;
  }
  if (session === undefined) {
    return <p role="status">Loading…</p>;
  }
  if (session === null) {
    // Stale/invalid token (expired, or from another deployment): clear it, otherwise the
    // login page sees a stored token and redirects straight back here, looping forever.
    clearSessionToken();
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}
