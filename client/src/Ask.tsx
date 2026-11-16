import { useEffect, useState, type FormEvent } from "react";
import { api, type Answer, type OverdueAction, type Session, type WorkFinding } from "./api.ts";

export function AskView({
  session,
  findingId,
  onOpenFinding,
}: {
  session: Session;
  findingId: string | null;
  onOpenFinding?: (id: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Array<{ question: string; answer: Answer }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [overdue, setOverdue] = useState<OverdueAction[]>([]);
  const [findings, setFindings] = useState<WorkFinding[]>([]);

  useEffect(() => {
    api.work(session.token).then((body) => {
      setOverdue(body.overdue);
      setFindings(body.findings);
    }).catch(() => undefined);
  }, [session.token]);

  const commander = session.roles.includes("commander");
  const assigned = findings.filter((finding) => finding.actionOwnerUserId === session.userId && finding.actionStatus !== "closed");
  const waiting = findings.filter((finding) => (commander ? finding.step === "decide" : finding.step === "assess" || finding.step === "assign"));
  const suggestions = commander
    ? ["What is overdue in my account?", "What is waiting for my decision?", "What is assigned to me?"]
    : ["What is overdue in my account?", "What is assigned to me?", "What is waiting on my step?"];

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setError(null);
    setPending(true);
    try {
      const earlier = turns.slice(-8).map((turn) => ({
        question: turn.question,
        answer: spoken(turn.answer),
      }));
      const answer = await api.ask(session.token, trimmed, findingId, earlier);
      setTurns((current) => [...current, { question: trimmed, answer }]);
      setQuestion("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The question failed");
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    ask(question).catch(() => undefined);
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">{commander ? "Commander questions" : "Ask"}</h2>
        <p className="mt-1 max-w-2xl text-[#5c5348]">
          Ask what is assigned or overdue. The reply uses the records this account can already open. It does not accept risk, assign an action, or close a record.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <WorkList title="Overdue" empty="Nothing in this account is past due." rows={overdue.map((action) => ({
          id: action.id,
          findingId: action.findingId,
          kicker: `Past due · ${action.dueOn}`,
          text: action.description,
        }))} onOpenFinding={onOpenFinding} />
        <WorkList
          title={commander ? "Waiting for a decision" : "Waiting on your step"}
          empty="Nothing is waiting in this lane."
          rows={(commander ? waiting : assigned.length > 0 ? assigned : waiting).map((finding) => ({
            id: finding.id,
            findingId: finding.id,
            kicker: finding.step,
            text: finding.originalText,
          }))}
          onOpenFinding={onOpenFinding}
        />
      </div>
      <div className="panel space-y-4">
        {turns.length === 0 ? <p className="text-sm text-[#6d6256]">Ask in your own words, or use one of the questions below.</p> : null}
        {turns.map((turn) => (
          <div key={`${turn.question}-${turn.answer.id}`} className="space-y-2">
            <p className="text-sm font-medium">{turn.question}</p>
            <div className="rounded-2xl bg-[#fffdf8] p-3 text-sm ring-1 ring-[#eadfce]">
              <p>{spoken(turn.answer)}</p>
              {turn.answer.recordCitations.length > 0 ? (
                <ul className="mt-2 space-y-1 text-[#5c5348]">
                  {turn.answer.recordCitations.map((record) => (
                    <li key={record.id}>{record.label}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ))}
        <form className="space-y-3" onSubmit={submit}>
          <label className="block text-sm font-medium">
            Question
            <textarea
              className="mt-1 w-full rounded border border-[#eadfce] bg-white px-3 py-2 font-normal"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </label>
          <p className="text-sm text-[#6d6256]">
            {findingId ? "The open finding is included with the question." : "No finding is open. The question uses this account's records."}
          </p>
          {error ? <p className="text-sm text-red-800">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <button key={item} className="btn-quiet" type="button" disabled={pending} onClick={() => ask(item).catch(() => undefined)}>
                {item}
              </button>
            ))}
            <button className="btn" type="submit" disabled={pending}>
              {pending ? "Asking" : "Ask"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function spoken(answer: Answer): string {
  const lines = [...answer.facts, ...answer.recommendations];
  if (lines.length > 0) return lines.join(" ");
  return "The reply did not list a fact from the supplied records.";
}

function WorkList({
  title,
  empty,
  rows,
  onOpenFinding,
}: {
  title: string;
  empty: string;
  rows: Array<{ id: string; findingId: string; kicker: string; text: string }>;
  onOpenFinding?: (id: string) => void;
}) {
  return (
    <section className="panel">
      <h3 className="font-semibold">{title}</h3>
      {rows.length === 0 ? <p className="mt-2 text-sm text-[#6d6256]">{empty}</p> : null}
      <ul className="mt-3 space-y-2">
        {rows.slice(0, 6).map((row) => (
          <li key={row.id}>
            <button className="text-left" type="button" onClick={() => onOpenFinding?.(row.findingId)}>
              <span className="text-xs font-semibold tracking-wide text-[#8a6a32]">{row.kicker}</span>
              <span className="block">{row.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
