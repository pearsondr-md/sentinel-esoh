import { useEffect, useState, type FormEvent } from "react";
import { PROGRAM_AREAS, WASTE_KINDS } from "../../shared/src/index.ts";
import { api, type FindingSummary, type Obligation, type Session, type Spill, type WasteStream } from "./api.ts";

export type EnvironmentalSelection =
  | { kind: "obligation"; id: string }
  | { kind: "waste"; id: string }
  | { kind: "spill"; id: string };

export function EnvironmentalLists({
  session,
  selected,
  onSelect,
}: {
  session: Session;
  selected: EnvironmentalSelection | null;
  onSelect: (selection: EnvironmentalSelection) => void;
}) {
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [wastes, setWastes] = useState<WasteStream[]>([]);
  const [spills, setSpills] = useState<Spill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const safety = session.roles.includes("safety officer");

  async function reload() {
    const [obligationBody, wasteBody, spillBody] = await Promise.all([
      api.obligations(session.token),
      api.wasteStreams(session.token),
      api.spills(session.token),
    ]);
    setObligations(obligationBody.obligations);
    setWastes(wasteBody.wasteStreams);
    setSpills(spillBody.spills);
  }

  useEffect(() => {
    reload().catch((caught: unknown) => setError(messageOf(caught)));
  }, [session.token]);

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Environmental</h2>
      <p className="mb-3 text-sm text-stone-600">
        Duties are tracked here. A permit condition, an enforcement matter, and spill liability stay with legal counsel.
      </p>
      {error ? <p className="mb-3 text-sm text-red-800">{error}</p> : null}
      <RecordList
        title="Obligations"
        items={obligations.map((item) => ({ id: item.id, label: item.title, detail: item.programArea }))}
        selectedId={selected?.kind === "obligation" ? selected.id : null}
        onSelect={(id) => onSelect({ kind: "obligation", id })}
      />
      {safety ? (
        <ObligationForm
          token={session.token}
          onCreated={(obligation) => {
            onSelect({ kind: "obligation", id: obligation.id });
            reload().catch((caught: unknown) => setError(messageOf(caught)));
          }}
        />
      ) : null}
      <RecordList
        title="Waste streams"
        items={wastes.map((item) => ({ id: item.id, label: item.name, detail: item.wasteKind }))}
        selectedId={selected?.kind === "waste" ? selected.id : null}
        onSelect={(id) => onSelect({ kind: "waste", id })}
      />
      {safety ? (
        <WasteForm
          token={session.token}
          obligations={obligations}
          onCreated={(waste) => {
            onSelect({ kind: "waste", id: waste.id });
            reload().catch((caught: unknown) => setError(messageOf(caught)));
          }}
        />
      ) : null}
      <RecordList
        title="Spills"
        items={spills.map((item) => ({ id: item.id, label: item.description, detail: item.reportedTo }))}
        selectedId={selected?.kind === "spill" ? selected.id : null}
        onSelect={(id) => onSelect({ kind: "spill", id })}
      />
      {safety ? (
        <SpillForm
          token={session.token}
          onCreated={(spill) => {
            onSelect({ kind: "spill", id: spill.id });
            reload().catch((caught: unknown) => setError(messageOf(caught)));
          }}
        />
      ) : null}
    </div>
  );
}

export function EnvironmentalDetail({
  session,
  selection,
  onSelectFinding,
}: {
  session: Session;
  selection: EnvironmentalSelection;
  onSelectFinding: (id: string) => void;
}) {
  const [findings, setFindings] = useState<FindingSummary[]>([]);
  const [heading, setHeading] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const safety = session.roles.includes("safety officer");

  async function reload() {
    if (selection.kind === "obligation") {
      const detail = await api.obligation(session.token, selection.id);
      setHeading(detail.obligation.title);
      setBody(`${detail.obligation.programArea}. Applies where: ${detail.obligation.applicabilityText}`);
      setFindings(detail.findings);
    } else if (selection.kind === "waste") {
      const detail = await api.wasteStream(session.token, selection.id);
      setHeading(detail.wasteStream.name);
      setBody(`Recorded waste distinction: ${detail.wasteStream.wasteKind}. SENTINEL stores that entry. It does not determine that a waste is hazardous.`);
      setFindings(detail.findings);
    } else {
      const detail = await api.spill(session.token, selection.id);
      setHeading(detail.spill.description);
      setBody(`Reported to ${detail.spill.reportedTo}. This record does not decide spill liability.`);
      setFindings(detail.findings);
    }
  }

  useEffect(() => {
    reload().catch((caught: unknown) => setError(messageOf(caught)));
  }, [selection.kind, selection.id, session.token]);

  return (
    <article className="rounded border border-stone-300 bg-white p-4">
      <h2 className="text-2xl font-semibold">{heading || "Environmental record"}</h2>
      <p className="mt-2">{body}</p>
      <p className="mt-2 text-sm text-stone-600">A finding from this record uses the same action path as an inspection finding.</p>
      {error ? <p className="mt-2 text-sm text-red-800">{error}</p> : null}
      <ul className="mt-3 space-y-2">
        {findings.map((finding) => (
          <li key={finding.id}>
            <button className="text-left underline" type="button" onClick={() => onSelectFinding(finding.id)}>
              {finding.originalText}
            </button>
            <span className="ml-2 text-sm text-stone-500">{finding.status}</span>
          </li>
        ))}
      </ul>
      {safety ? (
        <FindingFromEnvironment
          key={`${selection.kind}-${selection.id}`}
          onCreate={(originalText) => {
            const saved =
              selection.kind === "obligation"
                ? api.addFindingFromObligation(session.token, selection.id, originalText)
                : selection.kind === "waste"
                  ? api.addFindingFromWaste(session.token, selection.id, originalText)
                  : api.addFindingFromSpill(session.token, selection.id, originalText);
            return saved.then((finding) => {
              onSelectFinding(finding.id);
              return reload();
            });
          }}
        />
      ) : null}
    </article>
  );
}

function RecordList({
  title,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  items: Array<{ id: string; label: string; detail: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mb-3">
      <h3 className="mb-2 font-medium">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <button
              className={`w-full rounded border px-3 py-2 text-left ${item.id === selectedId ? "border-stone-900 bg-white" : "border-stone-300 bg-stone-50"}`}
              type="button"
              onClick={() => onSelect(item.id)}
            >
              <span className="block font-medium">{item.label}</span>
              <span className="text-sm text-stone-600">{item.detail}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ObligationForm({ token, onCreated }: { token: string; onCreated: (obligation: Obligation) => void }) {
  const [title, setTitle] = useState("");
  const [applicabilityText, setApplicabilityText] = useState("");
  const [programArea, setProgramArea] = useState<string>(PROGRAM_AREAS[4]);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="mb-4 space-y-2" onSubmit={(event) => submit(event, () => api.createObligation(token, title, applicabilityText, programArea).then(onCreated), setError)}>
      <h3 className="font-medium">Track an obligation</h3>
      <Field label="Duty" value={title} onChange={setTitle} />
      <Field label="Where it applies, and who issued it" value={applicabilityText} onChange={setApplicabilityText} />
      <label className="block text-sm font-medium">
        Program area
        <select className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 font-normal" value={programArea} onChange={(event) => setProgramArea(event.target.value)}>
          {PROGRAM_AREAS.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white" type="submit">
        Save obligation
      </button>
    </form>
  );
}

function WasteForm({
  token,
  obligations,
  onCreated,
}: {
  token: string;
  obligations: Obligation[];
  onCreated: (waste: WasteStream) => void;
}) {
  const [name, setName] = useState("");
  const [wasteKind, setWasteKind] = useState<string>(WASTE_KINDS[1]);
  const [obligationId, setObligationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mb-4 space-y-2"
      onSubmit={(event) =>
        submit(event, () => api.createWasteStream(token, name, wasteKind, obligationId || null).then(onCreated), setError)
      }
    >
      <h3 className="font-medium">Track a waste stream</h3>
      <Field label="Name" value={name} onChange={setName} />
      <label className="block text-sm font-medium">
        Recorded distinction
        <select className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 font-normal" value={wasteKind} onChange={(event) => setWasteKind(event.target.value)}>
          <option value="subtitle C">Subtitle C</option>
          <option value="other">Other waste</option>
        </select>
      </label>
      <p className="text-sm text-stone-600">Subtitle C is the hazardous-waste distinction named for the Resource Conservation and Recovery Act. Other waste is the remaining category, including certain medical waste.</p>
      <label className="block text-sm font-medium">
        Linked obligation
        <select className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 font-normal" value={obligationId} onChange={(event) => setObligationId(event.target.value)}>
          <option value="">None</option>
          {obligations.map((obligation) => (
            <option key={obligation.id} value={obligation.id}>
              {obligation.title}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white" type="submit">
        Save waste stream
      </button>
    </form>
  );
}

function SpillForm({ token, onCreated }: { token: string; onCreated: (spill: Spill) => void }) {
  const [description, setDescription] = useState("");
  const [reportedTo, setReportedTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="space-y-2" onSubmit={(event) => submit(event, () => api.createSpill(token, description, reportedTo).then(onCreated), setError)}>
      <h3 className="font-medium">Record a spill</h3>
      <Field label="What happened" value={description} onChange={setDescription} />
      <Field label="Reported to" value={reportedTo} onChange={setReportedTo} />
      <p className="text-sm text-stone-600">The publication calls for immediate reporting to the garrison or the on-scene coordinator. This field stores that report. It does not send one.</p>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white" type="submit">
        Save spill
      </button>
    </form>
  );
}

function FindingFromEnvironment({ onCreate }: { onCreate: (originalText: string) => Promise<void> }) {
  const [originalText, setOriginalText] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        onCreate(originalText).catch((caught: unknown) => setError(messageOf(caught)));
      }}
    >
      <label className="block text-sm font-medium">
        Finding text, saved as first written
        <textarea className="mt-1 w-full rounded border border-stone-300 px-3 py-2 font-normal" value={originalText} onChange={(event) => setOriginalText(event.target.value)} />
      </label>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white" type="submit">
        Create finding
      </button>
    </form>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 font-normal" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function submit(event: FormEvent, action: () => Promise<unknown>, setError: (value: string | null) => void) {
  event.preventDefault();
  setError(null);
  action().catch((caught: unknown) => setError(messageOf(caught)));
}

function messageOf(caught: unknown): string {
  return caught instanceof Error ? caught.message : "Something went wrong";
}
