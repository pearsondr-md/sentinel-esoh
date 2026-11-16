import { useEffect, useState } from "react";
import { api, type CouncilReport, type Session } from "./api.ts";
import { Bars } from "./Charts.tsx";

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
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="panel">
          <h3 className="font-semibold">Findings</h3>
          <div className="mt-4">
            <Bars
              items={[
                { label: "Still open", value: numberOf(report.findings, "open"), tone: "#3d342b" },
                { label: "Work in progress", value: numberOf(report.findings, "action in progress"), tone: "#b8893a" },
                { label: "Closed", value: numberOf(report.findings, "action closed"), tone: "#7d8a62" },
              ]}
            />
          </div>
        </article>
        <article className="panel">
          <h3 className="font-semibold">Corrective actions</h3>
          <div className="mt-4">
            <Bars
              items={[
                { label: "Open", value: numberOf(report.actions, "open"), tone: "#3d342b" },
                { label: "Completed, not closed", value: numberOf(report.actions, "completed"), tone: "#b8893a" },
                { label: "Closed", value: numberOf(report.actions, "closed"), tone: "#7d8a62" },
              ]}
            />
          </div>
        </article>
        <article className="panel">
          <h3 className="font-semibold">Inspections</h3>
          <div className="mt-4">
            <Bars
              items={[
                { label: "Draft", value: numberOf(report.inspections, "draft"), tone: "#3d342b" },
                { label: "Complete", value: numberOf(report.inspections, "complete"), tone: "#7d8a62" },
              ]}
            />
          </div>
        </article>
        <article className="panel">
          <h3 className="font-semibold">Other records held</h3>
          <div className="mt-4">
            <Bars
              items={[
                { label: "Obligations", value: report.obligations },
                { label: "Waste streams", value: report.wasteStreams },
                { label: "Spills", value: report.spills },
                { label: "Exposure groups", value: report.exposureGroups.groups },
                { label: "People in those groups", value: report.exposureGroups.people },
              ]}
            />
          </div>
        </article>
      </div>
      <article className="panel">
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
      <article className="panel">
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

function numberOf(counts: Record<string, number>, status: string): number {
  return counts[status] ?? 0;
}
