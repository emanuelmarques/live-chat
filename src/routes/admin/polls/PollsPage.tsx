import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, api, type Id } from "../../../lib/convexClient";
import { getStoredSessionToken } from "../../../lib/session";
import { Button } from "../../../components/Button";
import { TextField } from "../../../components/TextField";
import { PollBanner } from "../../../components/PollBanner";

export function PollsPage() {
  const { eventId: eventIdParam } = useParams<{ eventId: string }>();
  const eventId = eventIdParam as Id<"events">;
  const sessionToken = getStoredSessionToken() ?? "";

  const activePoll = useQuery(api.polls.getActivePoll, { eventId });
  const createAndStart = useMutation(api.polls.createAndStartPoll);
  const reveal = useMutation(api.polls.revealResults);
  const end = useMutation(api.polls.endPoll);

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [revealMode, setRevealMode] = useState<"live" | "atEnd">("live");

  if (!eventIdParam) {
    return null;
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const trimmedOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
    if (!question.trim() || trimmedOptions.length < 2) return;
    await createAndStart({
      sessionToken,
      eventId,
      question: question.trim(),
      options: trimmedOptions,
      revealMode,
    });
    setQuestion("");
    setOptions(["", ""]);
    setRevealMode("live");
  }

  if (activePoll === undefined) {
    return <p role="status">Loading…</p>;
  }

  if (activePoll && activePoll.isActive) {
    return (
      <div className="stack" style={{ maxWidth: 560 }}>
        <h1 style={{ margin: 0 }}>Polls</h1>
        <h2 style={{ margin: 0 }}>Active poll</h2>
        <PollBanner poll={activePoll} />
        <div className="row" style={{ flexWrap: "wrap" }}>
          {activePoll.revealMode === "atEnd" && !activePoll.resultsVisible && (
            <Button variant="dark" onClick={() => reveal({ sessionToken, pollId: activePoll.pollId })}>
              Reveal results now
            </Button>
          )}
          <Button variant="danger" onClick={() => end({ sessionToken, pollId: activePoll.pollId })}>
            End poll
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ maxWidth: 560 }}>
      <h1 style={{ margin: 0 }}>Polls</h1>
      <h2 style={{ margin: 0 }}>Create a poll</h2>
      <form onSubmit={handleCreate} className="card card--lift stack">
        <TextField
          label="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
        />
        {options.map((opt, i) => (
          <TextField
            key={i}
            label={`Option ${i + 1}`}
            value={opt}
            onChange={(e) =>
              setOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))
            }
          />
        ))}
        <div className="row">
          {options.length < 6 && (
            <button type="button" className="btn btn--secondary" onClick={() => setOptions((prev) => [...prev, ""])}>
              + Add option
            </button>
          )}
          {options.length > 2 && (
            <button type="button" className="btn btn--secondary" onClick={() => setOptions((prev) => prev.slice(0, -1))}>
              − Remove option
            </button>
          )}
        </div>
        <fieldset>
          <legend>Results visibility</legend>
          <label className="row">
            <input
              type="radio"
              name="revealMode"
              checked={revealMode === "live"}
              onChange={() => setRevealMode("live")}
            />
            Show results live, as votes come in
          </label>
          <label className="row">
            <input
              type="radio"
              name="revealMode"
              checked={revealMode === "atEnd"}
              onChange={() => setRevealMode("atEnd")}
            />
            Reveal results only at the end
          </label>
        </fieldset>
        <Button type="submit">Start poll</Button>
      </form>
    </div>
  );
}
