import { useState, type FormEvent } from "react";
import { api, type Answer, type Session } from "./api.ts";

export function AskView({ session, findingId }: { session: Session; findingId: string | null }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      setAnswer(await api.ask(session.token, question, findingId));
      setQuestion("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The question failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Ask</h2>
        <p className="mt-1 text-stone-600">
          A question is answered from records this account can already open and from source-register cards. The reply is stored text.
        </p>
      </div>
      <form className="space-y-3" onSubmit={submit}>
        <label className="block text-sm font-medium">
          Question
          <textarea
            className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 font-normal"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </label>
        <p className="text-sm text-stone-600">
          {findingId ? "The open finding is included with the question." : "No finding is open. The question uses the records in this organization."}
        </p>
        {error ? <p className="text-sm text-red-800">{error}</p> : null}
        <button className="rounded bg-stone-900 px-4 py-2 text-white" type="submit" disabled={pending}>
          {pending ? "Asking" : "Ask"}
        </button>
      </form>
      {answer ? <AnswerView answer={answer} /> : null}
    </section>
  );
}

function AnswerView({ answer }: { answer: Answer }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">{answer.notice}</p>
      <Prose title="Facts" items={answer.facts} />
      <Prose title="Observations" items={answer.observations} />
      <Prose title="Assumptions" items={answer.assumptions} />
      <Prose title="Recommendations" items={answer.recommendations} />
      <section className="rounded border border-stone-900 bg-white p-4" aria-label="From Camp Sentinel records">
        <h3 className="font-semibold">From Camp Sentinel records</h3>
        {answer.recordCitations.length === 0 ? (
          <p className="mt-2 text-sm text-stone-600">No supplied record was cited.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {answer.recordCitations.map((record) => (
              <li key={record.id}>
                <span className="font-medium">{record.id}</span>
                <span className="text-stone-600"> — {record.label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded border border-amber-700 bg-amber-50 p-4" aria-label="From the source register">
        <h3 className="font-semibold">From the source register</h3>
        {answer.sourceCitations.length === 0 ? (
          <p className="mt-2 text-sm text-stone-600">No supplied source card was cited.</p>
        ) : (
          <ul className="mt-2 space-y-3 text-sm">
            {answer.sourceCitations.map((source) => (
              <li key={source.id}>
                <p className="font-medium">
                  {source.publication}, {source.citation}
                </p>
                <p>{source.reviewStatus === "verified" ? `Verified on ${source.reviewedOn}.` : `Still unresolved. Reviewed ${source.reviewedOn}.`}</p>
                <p className="text-stone-700">{source.statement}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded border border-red-800 bg-red-50 p-4" aria-label="Unverified">
        <h3 className="font-semibold">Unverified</h3>
        {answer.unverified.length === 0 ? (
          <p className="mt-2 text-sm text-stone-600">The reply did not name a record or publication outside the material that was supplied.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {answer.unverified.map((item) => (
              <li key={`${item.name}-${item.reason}`}>
                <span className="font-medium">{item.name}</span>
                <span className="text-stone-700"> — {item.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Prose({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <article>
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}
