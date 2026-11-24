import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, api, type Id } from "../../../lib/convexClient";
import { getStoredSessionToken } from "../../../lib/session";
import { Button } from "../../../components/Button";
import { TextField } from "../../../components/TextField";
import { PollBanner } from "../../../components/PollBanner";
import { PollHistory, type ClonedPoll } from "./PollHistory";
import { MAX_POLL_OPTION_LENGTH, MAX_POLL_QUESTION_LENGTH } from "../../../lib/limits";

export function PollsPage() {
  const { eventId: eventIdParam } = useParams<{ eventId: string }>();
  const eventId = eventIdParam as Id<"events">;
  const sessionToken = getStoredSessionToken() ?? "";

  const activePoll = useQuery(api.polls.getActivePoll, { eventId });
  const createAndStart = useMutation(api.polls.createAndStartPoll);
  const reveal = useMutation(api.polls.revealResults);
  const end = useMutation(api.polls.endPoll);

  const event = useQuery(api.events.getEvent, { eventId });
  const drafts = useQuery(api.polls.listDraftPolls, { sessionToken, eventId });
  const createDraft = useMutation(api.polls.createDraftPoll);
  const activate = useMutation(api.polls.activatePoll);
  const deleteDraft = useMutation(api.polls.deleteDraftPoll);

  const [tab, setTab] = useState<"manage" | "history">("manage");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [revealMode, setRevealMode] = useState<"live" | "atEnd">("live");
  const [actionError, setActionError] = useState<string | null>(null);

  /** Runs a moderator action; shows the server's message instead of failing silently. */
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setActionError(null);
    try {
      await action();
      return true;
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      // Convex wraps server errors ("... Uncaught Error: <message>"); keep just ours.
      const match = raw.match(/Uncaught Error: (.+?)(?:\n|$)/);
      setActionError(match?.[1] ?? "Something went wrong. Please try again.");
      return false;
    }
  }

  if (!eventIdParam) {
    return null;
  }

  function readForm() {
    const trimmedOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
    if (!question.trim() || trimmedOptions.length < 2) return null;
    return { question: question.trim(), options: trimmedOptions, revealMode };
  }

  function resetForm() {
    setQuestion("");
    setOptions(["", ""]);
    setRevealMode("live");
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const input = readForm();
    if (!input) return;
    const hasActive = Boolean(activePoll && activePoll.isActive);
    if (
      hasActive &&
      !window.confirm(
        "A poll is already live. Starting this one will close the current poll (its results are kept). Continue?",
      )
    ) {
      return;
    }
    const ok = await run(async () => {
      if (hasActive) {
        const { pollId } = await createDraft({ sessionToken, eventId, ...input });
        await activate({ sessionToken, pollId, replaceActive: true });
      } else {
        await createAndStart({ sessionToken, eventId, ...input });
      }
    });
    if (ok) resetForm();
  }

  function handleClone(poll: ClonedPoll) {
    setQuestion(poll.question);
    setOptions(poll.options);
    setRevealMode(poll.revealMode);
  }

  async function handleSaveDraft() {
    const input = readForm();
    if (!input) return;
    const ok = await run(() => createDraft({ sessionToken, eventId, ...input }));
    if (ok) resetForm();
  }

  async function handleActivate(pollId: Id<"polls">) {
    const hasActive = Boolean(activePoll && activePoll.isActive);
    if (
      hasActive &&
      !window.confirm(
        "A poll is already live. Activating this one will close the current poll (its results are kept). Continue?",
      )
    ) {
      return;
    }
    await run(() => activate({ sessionToken, pollId, replaceActive: hasActive }));
  }

  async function handleDeleteDraft(pollId: Id<"polls">) {
    if (!window.confirm("Delete this prepared poll?")) return;
    await run(() => deleteDraft({ sessionToken, pollId }));
  }

  if (activePoll === undefined || drafts === undefined || event === undefined) {
    return <p role="status">Loading…</p>;
  }

  const preparedPolls = (
    <section className="stack" aria-label="Prepared polls">
      <h2 style={{ margin: 0 }}>Prepared polls</h2>
      {drafts.length === 0 ? (
        <p style={{ margin: 0 }}>
          No prepared polls yet. Save one as a draft to launch it quickly during the event.
        </p>
      ) : (
        <div className="card-grid">
          {drafts.map((draft) => (
            <div key={draft.pollId} className="card stack">
              <strong>{draft.question}</strong>
              <ul style={{ margin: 0 }}>
                {draft.options.map((opt, i) => (
                  <li key={i}>{opt}</li>
                ))}
              </ul>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <Button onClick={() => handleActivate(draft.pollId)}>Go live</Button>
                <Button variant="secondary" onClick={() => handleDeleteDraft(draft.pollId)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const activeSection =
    activePoll && activePoll.isActive ? (
      <section className="stack" aria-label="Active poll">
        <h2 style={{ margin: 0 }}>Active poll</h2>
        <PollBanner poll={activePoll} />
        <div className="row" style={{ flexWrap: "wrap" }}>
          {activePoll.revealMode === "atEnd" && !activePoll.resultsVisible && (
            <Button
              variant="dark"
              onClick={() => run(() => reveal({ sessionToken, pollId: activePoll.pollId }))}
            >
              Reveal results now
            </Button>
          )}
          <Button
            variant="danger"
            onClick={() => run(() => end({ sessionToken, pollId: activePoll.pollId }))}
          >
            End poll
          </Button>
        </div>
      </section>
    ) : null;

  const eventLive = event?.status === "active";

  const createForm = (
    <form onSubmit={handleCreate} className="card card--lift stack">
      <TextField
        label="Question"
        maxLength={MAX_POLL_QUESTION_LENGTH}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        required
      />
      {options.map((opt, i) => (
        <TextField
          key={i}
          label={`Option ${i + 1}`}
          maxLength={MAX_POLL_OPTION_LENGTH}
          value={opt}
          onChange={(e) =>
            setOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))
          }
        />
      ))}
      <div className="row">
        {options.length < 6 && (
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => setOptions((prev) => [...prev, ""])}
          >
            + Add option
          </button>
        )}
        {options.length > 2 && (
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => setOptions((prev) => prev.slice(0, -1))}
          >
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
      <div className="row" style={{ flexWrap: "wrap" }}>
        {eventLive && <Button type="submit">Start poll</Button>}
        <Button
          type="button"
          variant={eventLive ? "secondary" : "primary"}
          onClick={handleSaveDraft}
        >
          Save for later
        </Button>
        <Button type="button" variant="secondary" onClick={resetForm}>
          Clear
        </Button>
      </div>
    </form>
  );

  return (
    <div className="polls-layout">
      <div className="stack polls-layout__main">
        <h1 style={{ margin: 0 }}>Polls</h1>
        {actionError && (
          <p role="alert" className="alert">
            {actionError}
          </p>
        )}
        <div role="tablist" aria-label="Polls sections" className="row">
          <Button
            role="tab"
            aria-selected={tab === "manage"}
            variant={tab === "manage" ? "dark" : "secondary"}
            onClick={() => setTab("manage")}
          >
            Manage
          </Button>
          <Button
            role="tab"
            aria-selected={tab === "history"}
            variant={tab === "history" ? "dark" : "secondary"}
            onClick={() => setTab("history")}
          >
            History
          </Button>
        </div>
        {tab === "history" ? (
          <PollHistory eventId={eventId} onClone={handleClone} />
        ) : (
          <>
            {activeSection}
            {preparedPolls}
          </>
        )}
      </div>
      <aside className="polls-layout__side stack" aria-label="Create a poll">
        <h2 style={{ margin: 0 }}>New poll</h2>
        {createForm}
      </aside>
    </div>
  );
}
