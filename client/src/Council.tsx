import { useEffect, useState } from "react";
import { api, type CouncilReport, type Session } from "./api.ts";

export function CouncilView({ session }: { session: Session }) {
  const [report, setReport] = useState<CouncilReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .council(session.token)
      .then(setReport)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Something went wrong"));
  }, [session.token]);

  if (!report) {
    return <p>{error ?? "Loading the council counts."}</p>;
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Council</h2>
        <p className="mt-1 text-stone-600">
          Counts from SENTINEL records for this organization, as of {report.asOf}. This is not a readiness rating.
        </p>
      </div>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <article className="rounded border border-stone-300 bg-white p-4">
        <h3 className="font-semibold">Records held</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Count label="Findings still open" value={numberOf(report.findings, "open")} />
          <Count label="Findings with work in progress" value={numberOf(report.findings, "action in progress")} />
          <Count label="Findings closed" value={numberOf(report.findings, "action closed")} />
          <Count label="Actions open" value={numberOf(report.actions, "open")} />
          <Count label="Actions completed, not closed" value={numberOf(report.actions, "completed")} />
          <Count label="Actions closed" value={numberOf(report.actions, "closed")} />
          <Count label="Inspections in draft" value={numberOf(report.inspections, "draft")} />
          <Count label="Inspections complete" value={numberOf(report.inspections, "complete")} />
          <Count label="Exposure groups" value={report.exposureGroups.groups} />
          <Count label="People counted in exposure groups" value={report.exposureGroups.people} />
          <Count label="Obligations" value={report.obligations} />
          <Count label="Waste streams" value={report.wasteStreams} />
          <Count label="Spills" value={report.spills} />
        </dl>
      </article>
      <article className="rounded border border-stone-300 bg-white p-4">
        <h3 className="font-semibold">Actions past due</h3>
        {report.overdueActions.length === 0 ? (
          <p className="mt-2 text-stone-600">No open action has a due date before today.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {report.overdueActions.map((action) => (
              <li key={action.id}>
                {action.description} <span className="text-sm text-stone-600">Due {action.dueOn}. Status: {action.status}.</span>
              </li>
            ))}
          </ul>
        )}
      </article>
      <article className="rounded border border-stone-300 bg-white p-4">
        <h3 className="font-semibold">Asked for in paragraph 1-17, not stored</h3>
        <ul className="mt-2 space-y-2">
          {report.notStored.map((item) => (
            <li key={item.item}>
              <span className="font-medium">{item.item}.</span> {item.reason}
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-sm text-stone-600">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </div>
  );
}

function numberOf(counts: Record<string, number>, status: string): number {
  return counts[status] ?? 0;
}
