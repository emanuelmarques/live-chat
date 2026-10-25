import { useParams } from "react-router-dom";
import { useQuery, api, type Id } from "../../../lib/convexClient";
import { getStoredSessionToken } from "../../../lib/session";
import { Button } from "../../../components/Button";

export function ExportPage() {
  const { eventId: eventIdParam } = useParams<{ eventId: string }>();
  const eventId = eventIdParam as Id<"events">;
  const sessionToken = getStoredSessionToken() ?? "";
  const result = useQuery(api.export.exportChatCsv, { sessionToken, eventId });

  if (!eventIdParam) {
    return null;
  }

  function handleDownload() {
    if (!result) return;
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `chat-export-${eventId}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="stack" style={{ alignItems: "flex-start" }}>
      <h1 style={{ margin: 0 }}>Export chat</h1>
      {result === undefined ? (
        <p role="status">Loading…</p>
      ) : (
        <Button onClick={handleDownload}>Download CSV</Button>
      )}
    </div>
  );
}
