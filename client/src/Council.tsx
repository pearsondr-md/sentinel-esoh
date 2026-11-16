import { useEffect, useState } from "react";
import { api, type CouncilRecord, type CouncilReport, type Session } from "./api.ts";
import { Bars } from "./Charts.tsx";
import type { EnvironmentalSelection } from "./Environmental.tsx";

export function CouncilView({
  session,
  onOpenFinding,
  onOpenInspection,
  onOpenEnvironment,
  onOpenExposure,
}: {
  session: Session;
  onOpenFinding: (id: string) => void;
  onOpenInspection: (id: string) => void;
  onOpenEnvironment: (selection: EnvironmentalSelection) => void;
  onOpenExposure: (id: string) => void;
}) {
  const [report, setReport] = useState<CouncilReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    api
      .council(session.token)
      .then(setReport)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Something went wrong"));
  }, [session.token]);

  if (!report) {
    return <p>{error ?? "Loading the council counts."}</p>;
  }

  function choose(key: string) {
    setSelected((current) => (current === key ? null : key));
  }

  const drill = selected ? drillFor(report, selected) : null;
  const missing = selected?.startsWith("missing:")
    ? report.notStored.find((item) => item.item === selected.slice("missing:".length))
    : undefined;

  if (missing) {
    return (
      <section className="panel space-y-3">
        <button className="text-sm text-[#8a6a32] underline" type="button" onClick={() => setSelected(null)}>
          Back to council
        </button>
        <h2 className="text-2xl font-semibold">{missing.item}</h2>
        <p>{missing.reason}</p>
        <p className="text-sm text-[#6d6256]">No rows. SENTINEL does not store this, so there is no list to open.</p>
      </section>
    );
  }

  if (drill) {
    return (
      <section className="space-y-4">
        <div className="panel">
          <button className="text-sm text-[#8a6a32] underline" type="button" onClick={() => setSelected(null)}>
            Back to council
          </button>
          <h2 className="mt-2 text-2xl font-semibold">{drill.title}</h2>
          <p className="mt-1 text-[#5c5348]">{drill.note}</p>
        </div>
        {drill.rows.length === 0 ? <p className="text-sm text-[#6d6256]">No records in this bucket.</p> : null}
        <ul className="space-y-3">
          {drill.rows.map((row) => (
            <li key={row.id}>
              <button
                className="panel w-full text-left"
                type="button"
                onClick={() => openRow(drill.kind, row, { onOpenFinding, onOpenInspection, onOpenEnvironment, onOpenExposure })}
              >
                <span className="block font-medium">{row.label}</span>
                <span className="mt-1 block text-sm text-[#6d6256]">
                  {row.step ? `Step: ${row.step}. ` : ""}
                  {row.status ? `Status: ${row.status}. ` : ""}
                  {row.headcount != null ? `${row.headcount} people. Names are not stored. ` : ""}
                  {row.dueOn ? `Due ${row.dueOn}. ` : ""}
                  Open this record.
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Council</h2>
        <p className="mt-1 text-[#5c5348]">
          Counts from SENTINEL records for this organization, as of {report.asOf}. A bar opens the records behind it. This is not a readiness rating.
        </p>
      </div>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="panel">
          <h3 className="font-semibold">Findings</h3>
          <div className="mt-4">
            <Bars
              selected={selected}
              onSelect={choose}
              items={[
                { key: "findings:open", label: "Still open", value: numberOf(report.findings, "open"), tone: "#3d342b" },
                { key: "findings:action in progress", label: "Work in progress", value: numberOf(report.findings, "action in progress"), tone: "#b8893a" },
                { key: "findings:action closed", label: "Closed", value: numberOf(report.findings, "action closed"), tone: "#7d8a62" },
              ]}
            />
          </div>
        </article>
        <article className="panel">
          <h3 className="font-semibold">Corrective actions</h3>
          <div className="mt-4">
            <Bars
              selected={selected}
              onSelect={choose}
              items={[
                { key: "actions:open", label: "Open", value: numberOf(report.actions, "open"), tone: "#3d342b" },
                { key: "actions:completed", label: "Completed, not closed", value: numberOf(report.actions, "completed"), tone: "#b8893a" },
                { key: "actions:closed", label: "Closed", value: numberOf(report.actions, "closed"), tone: "#7d8a62" },
              ]}
            />
          </div>
        </article>
        <article className="panel">
          <h3 className="font-semibold">Inspections</h3>
          <div className="mt-4">
            <Bars
              selected={selected}
              onSelect={choose}
              items={[
                { key: "inspections:draft", label: "Draft", value: numberOf(report.inspections, "draft"), tone: "#3d342b" },
                { key: "inspections:complete", label: "Complete", value: numberOf(report.inspections, "complete"), tone: "#7d8a62" },
              ]}
            />
          </div>
        </article>
        <article className="panel">
          <h3 className="font-semibold">Other records held</h3>
          <div className="mt-4">
            <Bars
              selected={selected}
              onSelect={choose}
              items={[
                { key: "obligations", label: "Obligations", value: report.obligations },
                { key: "wasteStreams", label: "Waste streams", value: report.wasteStreams },
                { key: "spills", label: "Spills", value: report.spills },
                { key: "materials", label: "Hazardous materials", value: report.materials },
                { key: "mishaps", label: "Mishaps", value: report.mishaps },
                { key: "training", label: "Training", value: report.training },
                { key: "wildlandFires", label: "Wildland fire", value: report.wildlandFires },
                { key: "exposureGroups", label: "Exposure groups", value: report.exposureGroups.groups },
                { key: "people", label: "People in those groups", value: report.exposureGroups.people },
              ]}
            />
          </div>
        </article>
      </div>
      <article className="panel">
        <h3 className="font-semibold">Actions past due</h3>
        {report.overdueActions.length === 0 ? (
          <p className="mt-2 text-[#6d6256]">No open action has a due date before today.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {report.overdueActions.map((action) => (
              <li key={action.id}>
                <button className="text-left" type="button" onClick={() => onOpenFinding(action.findingId)}>
                  {action.label} <span className="text-sm text-[#6d6256]">Due {action.dueOn}. Status: {action.status}.</span>
                </button>
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
              <button className="text-left underline" type="button" onClick={() => choose(`missing:${item.item}`)}>
                <span className="font-medium">{item.item}.</span> Open why this is not stored.
              </button>
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

function drillFor(report: CouncilReport, key: string): { title: string; note: string; kind: string; rows: CouncilRecord[] } | null {
  if (key.startsWith("missing:")) {
    return null;
  }
  if (key.startsWith("findings:")) {
    const status = key.slice("findings:".length);
    return {
      title: `Findings · ${status}`,
      note: "Each row is a finding. The step is where that record is stuck.",
      kind: "finding",
      rows: report.records.findings.filter((row) => row.status === status),
    };
  }
  if (key.startsWith("actions:")) {
    const status = key.slice("actions:".length);
    return {
      title: `Corrective actions · ${status}`,
      note: "Opening a row opens the finding that owns the action.",
      kind: "action",
      rows: report.records.actions.filter((row) => row.status === status),
    };
  }
  if (key.startsWith("inspections:")) {
    const status = key.slice("inspections:".length);
    return {
      title: `Inspections · ${status}`,
      note: "A draft with no finding is still at Identify.",
      kind: "inspection",
      rows: report.records.inspections.filter((row) => row.status === status),
    };
  }
  if (key === "obligations") {
    return { title: "Obligations", note: "An obligation is not a compliance determination.", kind: "obligation", rows: report.records.obligations };
  }
  if (key === "wasteStreams") {
    return { title: "Waste streams", note: "A waste stream is not a compliance determination.", kind: "waste", rows: report.records.wasteStreams };
  }
  if (key === "materials") {
    return { title: "Hazardous materials", note: "Each row says where the material and its safety data sheet are kept. The sheet text is not stored.", kind: "material", rows: report.records.materials };
  }
  if (key === "spills") {
    return { title: "Spills", note: "A spill record is what was reported, not a mishap class.", kind: "spill", rows: report.records.spills };
  }
  if (key === "mishaps") {
    return { title: "Mishaps", note: "A mishap names who was affected and the outcome. It does not assign a class or store a diagnosis.", kind: "mishap", rows: report.records.mishaps };
  }
  if (key === "training") {
    return { title: "Training", note: "A headcount and a due date. It is not a qualification.", kind: "training", rows: report.records.training };
  }
  if (key === "wildlandFires") {
    return { title: "Wildland fire", note: "A wildfire, a prescribed burn, or the work after the fire. An ignition plan is not stored.", kind: "fire", rows: report.records.wildlandFires };
  }
  if (key === "exposureGroups" || key === "people") {
    const people = report.records.exposureGroups.reduce((sum, row) => sum + (row.headcount ?? 0), 0);
    return {
      title: key === "people" ? "People in exposure groups" : "Exposure groups",
      note: `${people} people are the sum of these headcounts. Names, diagnoses, and exam results are not stored.`,
      kind: "exposure",
      rows: report.records.exposureGroups,
    };
  }
  return null;
}

function openRow(
  kind: string,
  row: CouncilRecord,
  handlers: {
    onOpenFinding: (id: string) => void;
    onOpenInspection: (id: string) => void;
    onOpenEnvironment: (selection: EnvironmentalSelection) => void;
    onOpenExposure: (id: string) => void;
  },
) {
  if (kind === "finding") handlers.onOpenFinding(row.id);
  if (kind === "action" && row.findingId) handlers.onOpenFinding(row.findingId);
  if (kind === "inspection") handlers.onOpenInspection(row.id);
  if (kind === "obligation") handlers.onOpenEnvironment({ kind: "obligation", id: row.id });
  if (kind === "waste") handlers.onOpenEnvironment({ kind: "waste", id: row.id });
  if (kind === "spill") handlers.onOpenEnvironment({ kind: "spill", id: row.id });
  if (kind === "material") handlers.onOpenEnvironment({ kind: "material", id: row.id });
  if (kind === "mishap") handlers.onOpenEnvironment({ kind: "mishap", id: row.id });
  if (kind === "training") handlers.onOpenEnvironment({ kind: "training", id: row.id });
  if (kind === "fire") handlers.onOpenEnvironment({ kind: "fire", id: row.id });
  if (kind === "exposure") handlers.onOpenExposure(row.id);
}
