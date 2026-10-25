import { Navigate } from "react-router-dom";
import { useQuery, api } from "../../lib/convexClient";
import { getStoredSessionToken } from "../../lib/session";

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
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}
