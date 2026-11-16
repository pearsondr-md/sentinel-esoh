import { useEffect, useState, type FormEvent } from "react";
import { PROGRAM_AREAS, WASTE_KINDS } from "../../shared/src/index.ts";
import {
  api,
  type AuditLine,
  type FindingSummary,
  type HazardousMaterial,
  type Mishap,
  type Obligation,
  type ProgramAuditSummary,
  type Session,
  type Spill,
  type SpillStep,
  type TrainingSession,
  type WasteStream,
  type WildlandFire,
} from "./api.ts";

export type EnvironmentalSelection =
  | { kind: "obligation"; id: string }
  | { kind: "waste"; id: string }
  | { kind: "spill"; id: string }
  | { kind: "material"; id: string }
  | { kind: "mishap"; id: string }
  | { kind: "training"; id: string }
  | { kind: "fire"; id: string }
  | { kind: "audit"; id: string };

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
  const [materials, setMaterials] = useState<HazardousMaterial[]>([]);
  const [materialNotice, setMaterialNotice] = useState("");
  const [mishaps, setMishaps] = useState<Mishap[]>([]);
  const [mishapNotice, setMishapNotice] = useState("");
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [fires, setFires] = useState<WildlandFire[]>([]);
  const [fireNotice, setFireNotice] = useState("");
  const [audits, setAudits] = useState<ProgramAuditSummary[]>([]);
  const [auditNotice, setAuditNotice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const safety = session.roles.includes("safety officer");

  async function reload() {
    const [obligationBody, wasteBody, spillBody, materialBody, mishapBody, trainingBody, fireBody, auditBody] = await Promise.all([
      api.obligations(session.token),
      api.wasteStreams(session.token),
      api.spills(session.token),
      api.materials(session.token),
      api.mishaps(session.token),
      api.training(session.token),
      api.wildlandFires(session.token),
      api.audits(session.token),
    ]);
    setObligations(obligationBody.obligations);
    setWastes(wasteBody.wasteStreams);
    setSpills(spillBody.spills);
    setMaterials(materialBody.materials);
    setMaterialNotice(materialBody.notice);
    setMishaps(mishapBody.mishaps);
    setMishapNotice(mishapBody.notice);
    setSessions(trainingBody.sessions);
    setFires(fireBody.fires);
    setFireNotice(fireBody.notice);
    setAudits(auditBody.audits);
    setAuditNotice(auditBody.notice);
  }

  useEffect(() => {
    reload().catch((caught: unknown) => setError(messageOf(caught)));
  }, [session.token]);

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Programs</h2>
      <p className="mb-3 text-sm text-stone-600">
        Environmental duties, mishaps, training, spill cleanup, and wildland fire sit on the same finding path. A class, an OSHA rate, a diagnosis, and an ignition plan are not stored.
      </p>
      {error ? <p className="mb-3 text-sm text-red-800">{error}</p> : null}
      <p className="mb-2 text-sm text-stone-600">{auditNotice}</p>
      <RecordList
        title="Program audits"
        items={audits.map((item) => ({
          id: item.id,
          label: item.title,
          detail: `${item.auditedOn}. ${item.met} met, ${item.notMet} not met, ${item.notLookedAt} not looked at.`,
        }))}
        selectedId={selected?.kind === "audit" ? selected.id : null}
        onSelect={(id) => onSelect({ kind: "audit", id })}
      />
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
      <p className="mb-2 text-sm text-stone-600">{materialNotice}</p>
      <RecordList
        title="Hazardous materials"
        items={materials.map((item) => ({ id: item.id, label: item.name, detail: `${item.storagePlace}. Sheet: ${item.sheetPlace}.` }))}
        selectedId={selected?.kind === "material" ? selected.id : null}
        onSelect={(id) => onSelect({ kind: "material", id })}
      />
      {safety ? (
        <MaterialForm
          token={session.token}
          onCreated={(material) => {
            onSelect({ kind: "material", id: material.id });
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
          materials={materials}
          onCreated={(spill) => {
            onSelect({ kind: "spill", id: spill.id });
            reload().catch((caught: unknown) => setError(messageOf(caught)));
          }}
        />
      ) : null}
      <p className="mb-2 text-sm text-stone-600">{mishapNotice}</p>
      <RecordList
        title="Mishaps"
        items={mishaps.map((item) => ({ id: item.id, label: item.narrative, detail: `${item.personnelCategory} · ${item.outcome}` }))}
        selectedId={selected?.kind === "mishap" ? selected.id : null}
        onSelect={(id) => onSelect({ kind: "mishap", id })}
      />
      {safety ? (
        <MishapForm
          token={session.token}
          onCreated={(mishap) => {
            onSelect({ kind: "mishap", id: mishap.id });
            reload().catch((caught: unknown) => setError(messageOf(caught)));
          }}
        />
      ) : null}
      <RecordList
        title="Training"
        items={sessions.map((item) => ({
          id: item.id,
          label: `${item.topic} · ${item.audience}`,
          detail: item.completedOn ? `Completed ${item.completedOn}. ${item.headcount} people.` : `Due ${item.dueOn}. ${item.headcount} people.`,
        }))}
        selectedId={selected?.kind === "training" ? selected.id : null}
        onSelect={(id) => onSelect({ kind: "training", id })}
      />
      {safety ? (
        <TrainingForm
          token={session.token}
          onCreated={(sessionRow) => {
            onSelect({ kind: "training", id: sessionRow.id });
            reload().catch((caught: unknown) => setError(messageOf(caught)));
          }}
        />
      ) : null}
      <p className="mb-2 text-sm text-stone-600">{fireNotice}</p>
      <RecordList
        title="Wildland fire"
        items={fires.map((item) => ({ id: item.id, label: `${item.kind} · ${item.place}`, detail: item.purpose }))}
        selectedId={selected?.kind === "fire" ? selected.id : null}
        onSelect={(id) => onSelect({ kind: "fire", id })}
      />
      {safety ? (
        <FireForm
          token={session.token}
          onCreated={(fire) => {
            onSelect({ kind: "fire", id: fire.id });
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
  const [steps, setSteps] = useState<SpillStep[]>([]);
  const [auditLines, setAuditLines] = useState<AuditLine[]>([]);
  const [heading, setHeading] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const safety = session.roles.includes("safety officer");

  async function reload() {
    setAuditLines([]);
    if (selection.kind === "obligation") {
      const detail = await api.obligation(session.token, selection.id);
      setHeading(detail.obligation.title);
      setBody(`${detail.obligation.programArea}. Applies where: ${detail.obligation.applicabilityText}`);
      setFindings(detail.findings);
      setSteps([]);
    } else if (selection.kind === "waste") {
      const detail = await api.wasteStream(session.token, selection.id);
      setHeading(detail.wasteStream.name);
      setBody(`Recorded waste distinction: ${detail.wasteStream.wasteKind}. SENTINEL stores that entry. It does not determine that a waste is hazardous.`);
      setFindings(detail.findings);
      setSteps([]);
    } else if (selection.kind === "spill") {
      const detail = await api.spill(session.token, selection.id);
      setHeading(detail.spill.description);
      setBody(`Reported to ${detail.spill.reportedTo}. ${detail.spill.materialName ? `${detail.spill.materialName} is kept at ${detail.spill.storagePlace}. The safety data sheet is ${detail.spill.sheetPlace?.toLowerCase()}. ` : ""}Cleanup steps record what was done. They do not decide liability, and the sheet text is not stored.`);
      setSteps(detail.steps);
      setFindings(detail.findings);
    } else if (selection.kind === "material") {
      const detail = await api.material(session.token, selection.id);
      setHeading(detail.material.name);
      setBody(`Kept at ${detail.material.storagePlace}. The safety data sheet is ${detail.material.sheetPlace.toLowerCase()}. The sheet text is not stored.`);
      setSteps([]);
      setFindings(detail.findings);
    } else if (selection.kind === "mishap") {
      const detail = await api.mishap(session.token, selection.id);
      setHeading(detail.mishap.narrative);
      setBody(`${detail.mishap.personnelCategory}. ${detail.mishap.outcome}. ${detail.mishap.occurredOn}. ${detail.notice}${detail.clock ? ` ${detail.clock}` : ""}`);
      setSteps([]);
      setFindings(detail.findings);
    } else if (selection.kind === "training") {
      const detail = await api.trainingSession(session.token, selection.id);
      setHeading(`${detail.session.topic} · ${detail.session.audience}`);
      setBody(`${detail.session.basis} ${detail.session.headcount} people. Due ${detail.session.dueOn}.${detail.session.completedOn ? ` Completed ${detail.session.completedOn}.` : " Not completed."}`);
      setSteps([]);
      setFindings(detail.findings);
    } else if (selection.kind === "audit") {
      const detail = await api.audit(session.token, selection.id);
      setHeading(detail.audit.title);
      setBody(`${detail.notice} ${detail.audit.auditedOn}. ${detail.audit.met} met, ${detail.audit.notMet} not met, ${detail.audit.notLookedAt} not looked at.`);
      setAuditLines(detail.lines);
      setSteps([]);
      setFindings([]);
    } else {
      const detail = await api.wildlandFire(session.token, selection.id);
      setHeading(`${detail.fire.kind} · ${detail.fire.place}`);
      setBody(`${detail.fire.purpose} ${detail.fire.note} Occurred ${detail.fire.occurredOn}.`);
      setSteps([]);
      setAuditLines([]);
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
      <p className="mt-2 text-sm text-stone-600">
        {selection.kind === "audit"
          ? "A line marked not met is already a finding in those words. The counts are not a score."
          : "A finding from this record uses the same action path as an inspection finding."}
      </p>
      {auditLines.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {auditLines.map((line) => (
            <li key={line.id}>
              {line.findingId ? (
                <button className="text-left underline" type="button" onClick={() => onSelectFinding(line.findingId ?? "")}>
                  {line.text}
                </button>
              ) : (
                <span>{line.text}</span>
              )}
              <span className="ml-2 text-sm text-stone-500">{line.result}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {steps.length > 0 ? (
        <ol className="mt-3 space-y-1 text-sm">
          {steps.map((step) => (
            <li key={step.id}><span className="font-medium capitalize">{step.step}.</span> {step.note}</li>
          ))}
        </ol>
      ) : null}
      {safety && selection.kind === "spill" ? (
        <SpillStepForm
          token={session.token}
          spillId={selection.id}
          onCreated={() => reload().catch((caught: unknown) => setError(messageOf(caught)))}
        />
      ) : null}
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
      {safety && selection.kind !== "audit" ? (
        <FindingFromEnvironment
          key={`${selection.kind}-${selection.id}`}
          onCreate={(originalText) => {
            const saved =
              selection.kind === "obligation"
                ? api.addFindingFromObligation(session.token, selection.id, originalText)
                : selection.kind === "waste"
                  ? api.addFindingFromWaste(session.token, selection.id, originalText)
                  : selection.kind === "spill"
                    ? api.addFindingFromSpill(session.token, selection.id, originalText)
                    : selection.kind === "material"
                      ? api.addFindingFromMaterial(session.token, selection.id, originalText)
                    : selection.kind === "mishap"
                      ? api.addFindingFromMishap(session.token, selection.id, originalText)
                      : selection.kind === "training"
                        ? api.addFindingFromTraining(session.token, selection.id, originalText)
                        : api.addFindingFromFire(session.token, selection.id, originalText);
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

function MaterialForm({ token, onCreated }: { token: string; onCreated: (material: HazardousMaterial) => void }) {
  const [name, setName] = useState("");
  const [storagePlace, setStoragePlace] = useState("");
  const [sheetPlace, setSheetPlace] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="mb-4 space-y-2" onSubmit={(event) => submit(event, () => api.createMaterial(token, name, storagePlace, sheetPlace).then(onCreated), setError)}>
      <h3 className="font-medium">Record a hazardous material</h3>
      <Field label="Name" value={name} onChange={setName} />
      <Field label="Where it is kept" value={storagePlace} onChange={setStoragePlace} />
      <Field label="Where the safety data sheet is posted" value={sheetPlace} onChange={setSheetPlace} />
      <p className="text-sm text-stone-600">Record the place. The sheet text is not stored.</p>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white" type="submit">Save material</button>
    </form>
  );
}

function SpillForm({
  token,
  materials,
  onCreated,
}: {
  token: string;
  materials: HazardousMaterial[];
  onCreated: (spill: Spill) => void;
}) {
  const [description, setDescription] = useState("");
  const [reportedTo, setReportedTo] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="space-y-2" onSubmit={(event) => submit(event, () => api.createSpill(token, description, reportedTo, materialId || null).then(onCreated), setError)}>
      <h3 className="font-medium">Record a spill</h3>
      <Field label="What happened" value={description} onChange={setDescription} />
      <Field label="Reported to" value={reportedTo} onChange={setReportedTo} />
      <label className="block text-sm font-medium">
        Material, if it is already on the inventory
        <select className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 font-normal" value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
          <option value="">None</option>
          {materials.map((material) => (
            <option key={material.id} value={material.id}>{material.name} · {material.storagePlace}</option>
          ))}
        </select>
      </label>
      <p className="text-sm text-stone-600">The publication calls for immediate reporting to the garrison or the on-scene coordinator. This field stores that report. It does not send one.</p>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white" type="submit">
        Save spill
      </button>
    </form>
  );
}

function MishapForm({ token, onCreated }: { token: string; onCreated: (mishap: Mishap) => void }) {
  const [occurredOn, setOccurredOn] = useState("2026-11-15");
  const [narrative, setNarrative] = useState("");
  const [personnelCategory, setPersonnelCategory] = useState("Soldier");
  const [outcome, setOutcome] = useState("near miss");
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="mb-4 space-y-2" onSubmit={(event) => submit(event, () => api.createMishap(token, occurredOn, narrative, personnelCategory, outcome).then((body) => onCreated(body.mishap)), setError)}>
      <h3 className="font-medium">Record a mishap</h3>
      <Field label="Date" value={occurredOn} onChange={setOccurredOn} />
      <Field label="What happened, with no name and no diagnosis" value={narrative} onChange={setNarrative} />
      <label className="block text-sm font-medium">
        Who was affected
        <select className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 font-normal" value={personnelCategory} onChange={(event) => setPersonnelCategory(event.target.value)}>
          {["Soldier", "DA civilian", "contractor", "public", "other"].map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Outcome
        <select className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 font-normal" value={outcome} onChange={(event) => setOutcome(event.target.value)}>
          {["near miss", "injury reported", "occupational illness reported", "property damage", "environmental damage"].map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white" type="submit">Save mishap</button>
    </form>
  );
}

function TrainingForm({ token, onCreated }: { token: string; onCreated: (session: TrainingSession) => void }) {
  const [topic, setTopic] = useState("Hazard communication");
  const [audience, setAudience] = useState("");
  const [dueOn, setDueOn] = useState("2026-12-15");
  const [headcount, setHeadcount] = useState("1");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mb-4 space-y-2"
      onSubmit={(event) => submit(event, () => api.createTraining(token, topic, audience, dueOn, Number(headcount), null).then(onCreated), setError)}
    >
      <h3 className="font-medium">Record training</h3>
      <label className="block text-sm font-medium">
        Topic
        <select className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 font-normal" value={topic} onChange={(event) => setTopic(event.target.value)}>
          {["Unit safety officer", "Hazard communication", "Spill response", "Wildland fire"].map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <Field label="Audience, by shop or duty" value={audience} onChange={setAudience} />
      <Field label="Due" value={dueOn} onChange={setDueOn} />
      <Field label="Headcount" value={headcount} onChange={setHeadcount} />
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white" type="submit">Save training</button>
    </form>
  );
}

function FireForm({ token, onCreated }: { token: string; onCreated: (fire: WildlandFire) => void }) {
  const [kind, setKind] = useState("wildfire");
  const [place, setPlace] = useState("");
  const [occurredOn, setOccurredOn] = useState("2026-11-15");
  const [purpose, setPurpose] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="mb-4 space-y-2" onSubmit={(event) => submit(event, () => api.createWildlandFire(token, kind, place, occurredOn, purpose, note).then(onCreated), setError)}>
      <h3 className="font-medium">Record a wildland fire</h3>
      <label className="block text-sm font-medium">
        Kind
        <select className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 font-normal" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="wildfire">Wildfire</option>
          <option value="prescribed burn">Prescribed burn</option>
          <option value="remediation">Remediation after a fire</option>
        </select>
      </label>
      <Field label="Place" value={place} onChange={setPlace} />
      <Field label="Date" value={occurredOn} onChange={setOccurredOn} />
      <Field label="Purpose" value={purpose} onChange={setPurpose} />
      <Field label="What is known" value={note} onChange={setNote} />
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white" type="submit">Save fire record</button>
    </form>
  );
}

function SpillStepForm({ token, spillId, onCreated }: { token: string; spillId: string; onCreated: () => void }) {
  const [step, setStep] = useState("cleaned up");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="mt-3 space-y-2" onSubmit={(event) => submit(event, () => api.addSpillStep(token, spillId, step, note).then(() => { setNote(""); onCreated(); }), setError)}>
      <h3 className="font-medium">Cleanup step</h3>
      <label className="block text-sm font-medium">
        Step
        <select className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 font-normal" value={step} onChange={(event) => setStep(event.target.value)}>
          {["reported", "contained", "cleaned up", "waste held"].map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <Field label="What was done" value={note} onChange={setNote} />
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white" type="submit">Save step</button>
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

const AUDIT_RESULTS = ["met", "not met", "not looked at"] as const;

export function ProgramAudit({
  session,
  onOpenFinding,
}: {
  session: Session;
  onOpenFinding: (id: string) => void;
}) {
  const [notice, setNotice] = useState("");
  const [lines, setLines] = useState<AuditLine[]>([]);
  const [audits, setAudits] = useState<ProgramAuditSummary[]>([]);
  const [title, setTitle] = useState("Annual look");
  const [auditedOn, setAuditedOn] = useState("2026-11-15");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [openLines, setOpenLines] = useState<AuditLine[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canRecord = session.roles.includes("safety officer") || session.roles.includes("commander");

  useEffect(() => {
    Promise.all([api.auditLines(session.token), api.audits(session.token)])
      .then(([template, held]) => {
        setNotice(template.notice);
        setLines(template.lines);
        setAudits(held.audits);
        setAnswers(Object.fromEntries(template.lines.map((line) => [line.id, "not looked at"])));
      })
      .catch((caught: unknown) => setError(messageOf(caught)));
  }, [session.token]);

  return (
    <section className="panel space-y-3">
      <p className="text-xs font-semibold tracking-wide text-[#8a6a32]">Program audit</p>
      {audits[0] ? (
        <button
          className="task"
          type="button"
          onClick={() => {
            const shown = openLines.length > 0;
            if (shown) {
              setOpenLines([]);
              return;
            }
            api.audit(session.token, audits[0].id).then((detail) => setOpenLines(detail.lines)).catch((caught: unknown) => setError(messageOf(caught)));
          }}
        >
          <span className="text-xs font-semibold tracking-wide text-[#8a6a32]">Annual look</span>
          <span className="mt-1 block font-medium">
            {audits[0].title} — {audits[0].notMet > 0 ? `${audits[0].notMet} not met` : `${audits[0].met} met`}
          </span>
          <span className="mt-1 block text-sm text-[#6d6256]">Open the lines. The count is not a score and it is not a risk level.</span>
        </button>
      ) : (
        <h3 className="text-xl font-semibold">No look is on the books</h3>
      )}
      <p className="text-sm text-[#5c5348]">{notice}</p>
      {openLines.length > 0 ? (
        <ul className="space-y-2">
          {openLines.map((line) => (
            <li key={line.id} className="text-sm">
              {line.findingId ? (
                <button className="text-left underline" type="button" onClick={() => onOpenFinding(line.findingId ?? "")}>
                  {line.text}
                </button>
              ) : (
                <span>{line.text}</span>
              )}
              <span className="ml-2 text-[#6d6256]">{line.result}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {canRecord ? (
        <button className="btn-quiet" type="button" onClick={() => setStarting((current) => !current)}>
          {starting ? "Hide the new look" : "Start a look"}
        </button>
      ) : null}
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      {canRecord && starting ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            api
              .createAudit(
                session.token,
                title,
                auditedOn,
                lines.map((line) => ({ lineId: line.id, result: answers[line.id] ?? "not looked at" })),
              )
              .then((created) => {
                setAudits((current) => [created.audit, ...current]);
                const finding = created.findings[0];
                if (finding) onOpenFinding(finding.id);
              })
              .catch((caught: unknown) => setError(messageOf(caught)));
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" value={title} onChange={setTitle} />
            <Field label="Date" value={auditedOn} onChange={setAuditedOn} />
          </div>
          <ul className="space-y-3">
            {lines.map((line) => (
              <li key={line.id} className="rounded border border-[#eadfce] bg-[#fffdf8] p-3">
                <p className="text-xs font-semibold tracking-wide text-[#8a6a32]">{line.objective}</p>
                <p className="mt-1">{line.text}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {AUDIT_RESULTS.map((result) => (
                    <label key={result} className="text-sm">
                      <input
                        className="mr-1"
                        type="radio"
                        name={line.id}
                        checked={(answers[line.id] ?? "not looked at") === result}
                        onChange={() => setAnswers((current) => ({ ...current, [line.id]: result }))}
                      />
                      {result}
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {error ? <p className="text-sm text-red-800">{error}</p> : null}
          <button className="btn" type="submit">Save the look</button>
        </form>
      ) : null}
    </section>
  );
}
