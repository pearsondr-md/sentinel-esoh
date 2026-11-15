import { useEffect, useState, type FormEvent } from "react";
import {
  api,
  type EmployeeReport,
  type FindingChain,
  type Inspection,
  type OrgUser,
  type Session,
} from "./api.ts";
import { EnvironmentalDetail, EnvironmentalLists, type EnvironmentalSelection } from "./Environmental.tsx";
import { ExposureDetail, ExposureLists } from "./OccupationalHealth.tsx";
import { AskView } from "./Ask.tsx";
import { AsohmsView } from "./Asohms.tsx";
import { CouncilView } from "./Council.tsx";

const ACCOUNTS = [
  ["Shop 2 safety officer", "shop2.safety@camp-sentinel.example"],
  ["Shop 2 commander", "shop2.commander@camp-sentinel.example"],
  ["Shop 2 supervisor", "shop2.supervisor@camp-sentinel.example"],
  ["Shop 2 employee", "shop2.employee@camp-sentinel.example"],
] as const;

const PROBABILITY = [
  ["A", "Frequent"],
  ["B", "Likely"],
  ["C", "Occasional"],
  ["D", "Seldom"],
  ["E", "Unlikely"],
] as const;

const SEVERITY = [
  ["I", "Catastrophic"],
  ["II", "Critical"],
  ["III", "Moderate"],
  ["IV", "Negligible"],
] as const;

const sessionKey = "sentinel.session";

function Logo() {
  return (
    <svg aria-hidden="true" className="h-12 w-12 shrink-0" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="2" fill="#ffcc00" />
      <rect x="7" y="6" width="18" height="3" fill="#000" />
      <rect x="7" y="6" width="3" height="20" fill="#000" />
      <rect x="22" y="6" width="3" height="20" fill="#000" />
      <rect x="13" y="14" width="6" height="3" fill="#000" />
    </svg>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const saved = sessionStorage.getItem(sessionKey);
    return saved ? (JSON.parse(saved) as Session) : null;
  });

  function signIn(next: Session) {
    sessionStorage.setItem(sessionKey, JSON.stringify(next));
    setSession(next);
  }

  function signOut() {
    sessionStorage.removeItem(sessionKey);
    setSession(null);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b-4 border-[#ffcc00] bg-black text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <p className="text-xs font-semibold tracking-widest text-[#ffcc00]">CAMP SENTINEL</p>
              <h1 className="text-2xl font-semibold leading-none">SENTINEL</h1>
              <p className="mt-1 max-w-2xl text-sm text-white">
                Safety and occupational health records for the person who reports a hazard, the shop, the safety officer, and the commander.
              </p>
            </div>
          </div>
          {session ? (
            <div className="text-right">
              <p className="font-medium">{session.displayName}</p>
              <p className="text-sm text-white">{session.roles.join(", ")}</p>
              <button className="mt-2 text-sm text-[#ffcc00] underline" type="button" onClick={signOut}>
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        {session ? <Workspace session={session} /> : <SignIn onSignIn={signIn} />}
      </main>
    </div>
  );
}

function SignIn({ onSignIn }: { onSignIn: (session: Session) => void }) {
  const [email, setEmail] = useState<string>(ACCOUNTS[0][1]);
  const [password, setPassword] = useState("camp-sentinel-demo");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      onSignIn(await api.signIn(email, password));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed");
    }
  }

  return (
    <form className="max-w-md space-y-4" onSubmit={submit}>
      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Password</span>
        <input className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="rounded bg-stone-900 px-4 py-2 text-white" type="submit">
        Sign in
      </button>
      <div className="space-y-2 pt-4 text-sm text-stone-600">
        <p>Camp Sentinel accounts</p>
        {ACCOUNTS.map(([label, account]) => (
          <button
            key={account}
            className="block underline"
            type="button"
            onClick={() => {
              setEmail(account);
              setPassword("camp-sentinel-demo");
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </form>
  );
}

function Workspace({ session }: { session: Session }) {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [reports, setReports] = useState<EmployeeReport[]>([]);
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [environmental, setEnvironmental] = useState<EnvironmentalSelection | null>(null);
  const [exposureId, setExposureId] = useState<string | null>(null);
  const [showCouncil, setShowCouncil] = useState(false);
  const [showAsohms, setShowAsohms] = useState(false);
  const [showAsk, setShowAsk] = useState(false);
  const [findingId, setFindingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshInspections() {
    const body = await api.inspections(session.token);
    setInspections(body.inspections);
  }

  async function refreshReports() {
    const body = await api.reports(session.token);
    setReports(body.employeeReports);
  }

  useEffect(() => {
    Promise.all([refreshInspections(), refreshReports()]).catch((caught: unknown) => setError(messageOf(caught)));
  }, [session.token]);

  return (
    <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
      <section className="space-y-8">
        <div>
          <h2 className="mb-3 text-lg font-semibold">Council</h2>
          <button
            className={`w-full rounded border px-3 py-2 text-left ${showCouncil ? "border-stone-900 bg-white" : "border-stone-300 bg-stone-50"}`}
            type="button"
            onClick={() => {
              setShowCouncil(true);
              setShowAsohms(false);
                setShowAsk(false);
              setInspectionId(null);
              setReportId(null);
              setEnvironmental(null);
              setExposureId(null);
              setFindingId(null);
            }}
          >
            Counts for this organization
          </button>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">ASOHMS practice</h2>
          <button
            className={`w-full rounded border px-3 py-2 text-left ${showAsohms ? "border-stone-900 bg-white" : "border-stone-300 bg-stone-50"}`}
            type="button"
            onClick={() => {
              setShowAsohms(true);
              setShowCouncil(false);
              setShowAsk(false);
              setInspectionId(null);
              setReportId(null);
              setEnvironmental(null);
              setExposureId(null);
              setFindingId(null);
            }}
          >
            Six objectives
          </button>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Ask</h2>
          <button
            className={`w-full rounded border px-3 py-2 text-left ${showAsk ? "border-stone-900 bg-white" : "border-stone-300 bg-stone-50"}`}
            type="button"
            onClick={() => {
              setShowAsk(true);
              setShowCouncil(false);
              setShowAsohms(false);
              setInspectionId(null);
              setReportId(null);
              setEnvironmental(null);
              setExposureId(null);
            }}
          >
            Question
          </button>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Inspections</h2>
          {error ? <p className="mb-3 text-sm text-red-800">{error}</p> : null}
          <ul className="space-y-2">
            {inspections.map((inspection) => (
              <li key={inspection.id}>
                <button
                  className={`w-full rounded border px-3 py-2 text-left ${inspection.id === inspectionId ? "border-stone-900 bg-white" : "border-stone-300 bg-stone-50"}`}
                  type="button"
                  onClick={() => {
                    setInspectionId(inspection.id);
                    setReportId(null);
                    setEnvironmental(null);
                    setExposureId(null);
                    setShowCouncil(false);
                setShowAsohms(false);
                setShowAsk(false);
                    setFindingId(null);
                  }}
                >
                  <span className="block font-medium">{inspection.shopName}</span>
                  <span className="text-sm text-stone-600">
                    {inspection.inspectedOn} · {inspection.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {session.roles.includes("safety officer") ? (
            <NewInspection
              token={session.token}
              onCreated={(inspection) => {
                setInspectionId(inspection.id);
                setReportId(null);
                setEnvironmental(null);
                setExposureId(null);
                setShowCouncil(false);
                setShowAsohms(false);
                setShowAsk(false);
                setFindingId(null);
                refreshInspections().catch((caught: unknown) => setError(messageOf(caught)));
              }}
            />
          ) : null}
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Written reports</h2>
          <ul className="space-y-2">
            {reports.map((report) => (
              <li key={report.id}>
                <button
                  className={`w-full rounded border px-3 py-2 text-left ${report.id === reportId ? "border-stone-900 bg-white" : "border-stone-300 bg-stone-50"}`}
                  type="button"
                  onClick={() => {
                    setReportId(report.id);
                    setInspectionId(null);
                    setEnvironmental(null);
                    setExposureId(null);
                    setShowCouncil(false);
                setShowAsohms(false);
                setShowAsk(false);
                    setFindingId(null);
                  }}
                >
                  <span className="block font-medium">{report.text}</span>
                  <span className="text-sm text-stone-600">
                    {report.showName && report.reporterDisplayName ? report.reporterDisplayName : "Name withheld"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <ReportForm
            token={session.token}
            onCreated={(report) => {
              setReportId(report.id);
              setInspectionId(null);
              setEnvironmental(null);
              setExposureId(null);
              setShowCouncil(false);
                setShowAsohms(false);
                setShowAsk(false);
              setFindingId(null);
              refreshReports().catch((caught: unknown) => setError(messageOf(caught)));
            }}
          />
        </div>
        <EnvironmentalLists
            session={session}
            selected={environmental}
            onSelect={(selection) => {
              setEnvironmental(selection);
              setInspectionId(null);
              setReportId(null);
              setExposureId(null);
              setShowCouncil(false);
                setShowAsohms(false);
                setShowAsk(false);
              setFindingId(null);
            }}
          />
        <ExposureLists
          session={session}
          selectedId={exposureId}
          onSelect={(id) => {
            setExposureId(id);
            setInspectionId(null);
            setReportId(null);
            setEnvironmental(null);
            setShowCouncil(false);
                setShowAsohms(false);
                setShowAsk(false);
            setFindingId(null);
          }}
        />
      </section>
      {inspectionId ? (
        <InspectionDetail
          session={session}
          inspectionId={inspectionId}
          findingId={findingId}
          onSelectFinding={setFindingId}
        />
      ) : reportId ? (
        <ReportDetail
          session={session}
          reportId={reportId}
          findingId={findingId}
          onSelectFinding={setFindingId}
        />
      ) : environmental ? (
        <div className="space-y-6">
          <EnvironmentalDetail session={session} selection={environmental} onSelectFinding={setFindingId} />
          {findingId ? <FindingRecord session={session} findingId={findingId} /> : null}
        </div>
      ) : exposureId ? (
        <ExposureDetail session={session} groupId={exposureId} />
      ) : showCouncil ? (
        <CouncilView session={session} />
      ) : showAsohms ? (
        <AsohmsView session={session} />
      ) : showAsk ? (
        <AskView session={session} findingId={findingId} />
      ) : (
        <p className="text-stone-600">Choose an inspection, a written report, an environmental record, an exposure group, or a practice note.</p>
      )}
    </div>
  );
}

function InspectionDetail({
  session,
  inspectionId,
  findingId,
  onSelectFinding,
}: {
  session: Session;
  inspectionId: string;
  findingId: string | null;
  onSelectFinding: (id: string) => void;
}) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.inspection>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setDetail(await api.inspection(session.token, inspectionId));
  }

  useEffect(() => {
    reload().catch((caught: unknown) => setError(messageOf(caught)));
  }, [inspectionId, session.token]);

  if (!detail) {
    return <p>{error ?? "Loading the inspection."}</p>;
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">{detail.inspection.shopName}</h2>
        <p className="text-stone-600">
          {detail.inspection.inspectedOn} · {detail.inspection.status}
        </p>
      </div>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <div className="space-y-3">
        {detail.observations.map((observation) => (
          <article key={observation.id} className="rounded border border-stone-300 bg-white p-4">
            <h3 className="font-medium">Observation</h3>
            <p className="mt-1">{observation.text}</p>
            <ul className="mt-3 space-y-2">
              {detail.findings
                .filter((finding) => finding.sourceObservationId === observation.id)
                .map((finding) => (
                  <li key={finding.id}>
                    <button className="text-left underline" type="button" onClick={() => onSelectFinding(finding.id)}>
                      {finding.originalText}
                    </button>
                    <span className="ml-2 text-sm text-stone-500">{finding.status}</span>
                  </li>
                ))}
            </ul>
            {session.roles.includes("safety officer") ? (
              <FindingForm
                token={session.token}
                observationId={observation.id}
                onCreated={(finding) => {
                  onSelectFinding(finding.id);
                  reload().catch((caught: unknown) => setError(messageOf(caught)));
                }}
              />
            ) : null}
          </article>
        ))}
      </div>
      {session.roles.includes("safety officer") ? (
        <ObservationForm
          token={session.token}
          inspectionId={inspectionId}
          onCreated={() => reload().catch((caught: unknown) => setError(messageOf(caught)))}
        />
      ) : null}
      {findingId ? <FindingRecord session={session} findingId={findingId} /> : null}
    </section>
  );
}

function FindingRecord({ session, findingId }: { session: Session; findingId: string }) {
  const [chain, setChain] = useState<FindingChain | null>(null);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const [nextChain, nextUsers] = await Promise.all([
      api.finding(session.token, findingId),
      api.users(session.token),
    ]);
    setChain(nextChain);
    setUsers(nextUsers.users);
  }

  useEffect(() => {
    reload().catch((caught: unknown) => setError(messageOf(caught)));
  }, [findingId, session.token]);

  if (!chain) {
    return <p>{error ?? "Loading the finding."}</p>;
  }

  const hazard = chain.hazards[0];
  const initial = chain.assessments.find((assessment) => assessment.phase === "initial");
  const residual = chain.assessments.find((assessment) => assessment.phase === "residual");
  const safety = session.roles.includes("safety officer");
  const commander = session.roles.includes("commander");

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <article className="rounded border border-stone-300 bg-white p-4">
        <h3 className="font-semibold">Finding</h3>
        <p className="mt-2">{chain.finding.originalText}</p>
        <p className="mt-2 text-sm text-stone-600">Status: {chain.finding.status}. The original words stay on the record.</p>
      </article>

      <article className="rounded border border-stone-300 bg-white p-4">
        <h3 className="font-semibold">Hazard</h3>
        {hazard ? <p className="mt-2">{hazard.description}</p> : <p className="mt-2 text-stone-600">No hazard yet.</p>}
        {safety && !hazard ? (
          <HazardForm
            token={session.token}
            findingId={findingId}
            onCreated={() => reload().catch((caught: unknown) => setError(messageOf(caught)))}
          />
        ) : null}
      </article>

      <AssessmentBlock
        title="Initial risk"
        assessment={initial}
        canEstimate={safety && Boolean(hazard) && !initial}
        onEstimate={async (probabilityCode, severityCode) => {
          if (!hazard) return;
          await api.addAssessment(session.token, hazard.id, "initial", probabilityCode, severityCode);
          await reload();
        }}
      />
      <AssessmentBlock
        title="Residual risk"
        assessment={residual}
        canEstimate={safety && Boolean(initial) && !residual}
        onEstimate={async (probabilityCode, severityCode) => {
          if (!hazard) return;
          await api.addAssessment(session.token, hazard.id, "residual", probabilityCode, severityCode);
          await reload();
        }}
      />

      {residual ? (
        <article className="rounded border border-stone-300 bg-white p-4">
          <h3 className="font-semibold">Controls</h3>
          <ul className="mt-2 space-y-2">
            {chain.controls.map((control) => (
              <li key={control.id}>
                {control.whatText} {control.whoText} {control.howText}
              </li>
            ))}
          </ul>
          {safety ? (
            <ControlForm
              token={session.token}
              assessmentId={residual.id}
              onCreated={() => reload().catch((caught: unknown) => setError(messageOf(caught)))}
            />
          ) : null}
        </article>
      ) : null}

      <article className="rounded border border-stone-300 bg-white p-4">
        <h3 className="font-semibold">Commander's decision</h3>
        <ul className="mt-2 space-y-3">
          {chain.decisions.map((decision) => {
            const check = chain.authorityChecks.find((item) => item.decisionId === decision.id);
            return (
              <li key={decision.id} className="grid gap-2 sm:grid-cols-2">
                <p>
                  <span className="block text-sm text-stone-500">Decision</span>
                  {decision.decision} · {decision.gradeText ?? "no grade"} · {decision.durationText}
                </p>
                <p>
                  <span className="block text-sm text-stone-500">Authority check</span>
                  {check
                    ? `${check.result}. ${check.basis}${
                        check.result === "blocked" && decision.decision === "accept"
                          ? " Acceptance was not granted. The corrective action can still be assigned."
                          : ""
                      }`
                    : "Not recorded."}
                </p>
              </li>
            );
          })}
        </ul>
        {commander && residual ? (
          <DecisionForm
            token={session.token}
            assessmentId={residual.id}
            onCreated={() => reload().catch((caught: unknown) => setError(messageOf(caught)))}
          />
        ) : null}
      </article>

      <article className="rounded border border-stone-300 bg-white p-4">
        <h3 className="font-semibold">Corrective action</h3>
        <ul className="mt-2 space-y-3">
          {chain.actions.map((action) => (
            <li key={action.id} className="rounded border border-stone-200 p-3">
              <p>{action.description}</p>
              <p className="text-sm text-stone-600">Status: {action.status}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {chain.evidence
                  .filter((item) => item.actionId === action.id)
                  .map((item) => (
                    <li key={item.id}>
                      Evidence: {item.fileName}. SHA-256 {item.contentHash}
                    </li>
                  ))}
              </ul>
              {action.ownerUserId === session.userId ? (
                <EvidenceForm
                  token={session.token}
                  actionId={action.id}
                  onCreated={() => reload().catch((caught: unknown) => setError(messageOf(caught)))}
                />
              ) : null}
              {action.ownerUserId === session.userId && action.status !== "closed" && action.status !== "completed" ? (
                <button
                  className="mt-2 rounded bg-stone-900 px-3 py-1 text-sm text-white"
                  type="button"
                  onClick={() =>
                    api.completeAction(session.token, action.id).then(reload).catch((caught: unknown) => setError(messageOf(caught)))
                  }
                >
                  Mark the work complete
                </button>
              ) : null}
              {action.completedBy && action.completedBy !== session.userId && action.status === "completed" ? (
                <VerifyForm
                  token={session.token}
                  actionId={action.id}
                  onCreated={() => reload().catch((caught: unknown) => setError(messageOf(caught)))}
                />
              ) : null}
              {safety && action.status === "completed" ? (
                <button
                  className="mt-2 rounded border border-stone-900 px-3 py-1 text-sm"
                  type="button"
                  onClick={() =>
                    api.closeAction(session.token, action.id).then(reload).catch((caught: unknown) => setError(messageOf(caught)))
                  }
                >
                  Close the action
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {chain.verifications.length > 0 ? (
          <ul className="mt-3 text-sm text-stone-700">
            {chain.verifications.map((verification) => (
              <li key={verification.id}>
                Verification {verification.result}
                {verification.notes ? `: ${verification.notes}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
        {safety && hazard ? (
          <ActionForm
            token={session.token}
            findingId={findingId}
            hazardId={hazard.id}
            users={users}
            onCreated={() => reload().catch((caught: unknown) => setError(messageOf(caught)))}
          />
        ) : null}
      </article>
    </div>
  );
}

function AssessmentBlock({
  title,
  assessment,
  canEstimate,
  onEstimate,
}: {
  title: string;
  assessment?: FindingChain["assessments"][number];
  canEstimate: boolean;
  onEstimate: (probabilityCode: string, severityCode: string) => Promise<void>;
}) {
  const [probabilityCode, setProbabilityCode] = useState("C");
  const [severityCode, setSeverityCode] = useState("II");
  const [error, setError] = useState<string | null>(null);

  return (
    <article className="rounded border border-stone-300 bg-white p-4">
      <h3 className="font-semibold">{title}</h3>
      {assessment ? (
        <p className="mt-2">
          Probability {assessment.probabilityCode}, severity {assessment.severityCode}. Matrix result{" "}
          <strong>{assessment.matrixLevel}</strong>, cell {assessment.matrixCell}. {assessment.doctrineRef}.
        </p>
      ) : (
        <p className="mt-2 text-stone-600">No estimate yet. The level comes back from the matrix. It is not typed in.</p>
      )}
      {canEstimate ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onEstimate(probabilityCode, severityCode).catch((caught: unknown) => setError(messageOf(caught)));
          }}
        >
          <Select label="Probability" value={probabilityCode} options={PROBABILITY} onChange={setProbabilityCode} />
          <Select label="Severity" value={severityCode} options={SEVERITY} onChange={setSeverityCode} />
          <button className="rounded bg-stone-900 px-3 py-2 text-sm text-white" type="submit">
            Record estimate
          </button>
          {error ? <p className="text-sm text-red-800">{error}</p> : null}
        </form>
      ) : null}
    </article>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <select className="mt-1 block rounded border border-stone-300 bg-white px-2 py-2" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([code, name]) => (
          <option key={code} value={code}>
            {code} — {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function NewInspection({ token, onCreated }: { token: string; onCreated: (inspection: Inspection) => void }) {
  const [shopName, setShopName] = useState("Shop 2");
  const [inspectedOn, setInspectedOn] = useState("2026-11-15");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-4 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        api.createInspection(token, shopName, inspectedOn).then(onCreated).catch((caught: unknown) => setError(messageOf(caught)));
      }}
    >
      <h3 className="font-medium">New inspection</h3>
      <label className="block text-sm font-medium">
        Shop
        <input className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1" value={shopName} onChange={(event) => setShopName(event.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        Date
        <input className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1" value={inspectedOn} onChange={(event) => setInspectedOn(event.target.value)} />
      </label>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white" type="submit">
        Start inspection
      </button>
    </form>
  );
}

function ObservationForm({ token, inspectionId, onCreated }: { token: string; inspectionId: string; onCreated: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        api.addObservation(token, inspectionId, text).then(() => {
          setText("");
          onCreated();
        }).catch((caught: unknown) => setError(messageOf(caught)));
      }}
    >
      <label className="block text-sm font-medium">
        Observation
        <textarea className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 font-normal" value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white" type="submit">
        Save observation
      </button>
    </form>
  );
}

function ReportForm({ token, onCreated }: { token: string; onCreated: (report: EmployeeReport) => void }) {
  const [text, setText] = useState("");
  const [showName, setShowName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-4 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        api
          .createReport(token, text, showName)
          .then((report) => {
            setText("");
            setShowName(false);
            onCreated(report);
          })
          .catch((caught: unknown) => setError(messageOf(caught)));
      }}
    >
      <h3 className="font-medium">File a written report</h3>
      <label className="block text-sm font-medium">
        What you saw
        <textarea className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 font-normal" value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <label className="block text-sm">
        <input className="mr-2" type="checkbox" checked={showName} onChange={(event) => setShowName(event.target.checked)} />
        Show my name on the shared log
      </label>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white" type="submit">
        File report
      </button>
    </form>
  );
}

function ReportDetail({
  session,
  reportId,
  findingId,
  onSelectFinding,
}: {
  session: Session;
  reportId: string;
  findingId: string | null;
  onSelectFinding: (id: string) => void;
}) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.report>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setDetail(await api.report(session.token, reportId));
  }

  useEffect(() => {
    reload().catch((caught: unknown) => setError(messageOf(caught)));
  }, [reportId, session.token]);

  if (!detail) {
    return <p>{error ?? "Loading the report."}</p>;
  }

  return (
    <section className="space-y-6">
      <article className="rounded border border-stone-300 bg-white p-4">
        <h2 className="text-2xl font-semibold">Written report</h2>
        <p className="mt-2">{detail.report.text}</p>
        <p className="mt-2 text-sm text-stone-600">
          {detail.report.showName && detail.report.reporterDisplayName
            ? `Filed by ${detail.report.reporterDisplayName}`
            : "The reporter's name is withheld on this log."}
        </p>
        <ul className="mt-3 space-y-2">
          {detail.findings.map((finding) => (
            <li key={finding.id}>
              <button className="text-left underline" type="button" onClick={() => onSelectFinding(finding.id)}>
                {finding.originalText}
              </button>
              <span className="ml-2 text-sm text-stone-500">{finding.status}</span>
            </li>
          ))}
        </ul>
        {session.roles.includes("safety officer") ? (
          <FindingForm
            key={reportId}
            token={session.token}
            reportId={reportId}
            initialText={detail.report.text}
            onCreated={(finding) => {
              onSelectFinding(finding.id);
              reload().catch((caught: unknown) => setError(messageOf(caught)));
            }}
          />
        ) : null}
      </article>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      {findingId ? <FindingRecord session={session} findingId={findingId} /> : null}
    </section>
  );
}

function FindingForm({
  token,
  observationId,
  reportId,
  initialText = "",
  onCreated,
}: {
  token: string;
  observationId?: string;
  reportId?: string;
  initialText?: string;
  onCreated: (finding: { id: string }) => void;
}) {
  const [originalText, setOriginalText] = useState(initialText);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const saved = reportId
          ? api.addFindingFromReport(token, reportId, originalText)
          : api.addFinding(token, observationId ?? "", originalText);
        saved.then(onCreated).catch((caught: unknown) => setError(messageOf(caught)));
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

function HazardForm({ token, findingId, onCreated }: { token: string; findingId: string; onCreated: () => void }) {
  const [description, setDescription] = useState("People may handle unknown contents.");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        api.addHazard(token, findingId, description).then(onCreated).catch((caught: unknown) => setError(messageOf(caught)));
      }}
    >
      <label className="block text-sm font-medium">
        Hazard
        <textarea className="mt-1 w-full rounded border border-stone-300 px-3 py-2 font-normal" value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white" type="submit">
        Link hazard
      </button>
    </form>
  );
}

function ControlForm({
  token,
  assessmentId,
  onCreated,
}: {
  token: string;
  assessmentId: string;
  onCreated: () => void;
}) {
  const [whatText, setWhatText] = useState("Label the container or dispose of it.");
  const [whoText, setWhoText] = useState("Shop 2 supervisor");
  const [howText, setHowText] = useState("Before the next shift.");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        api.addControl(token, assessmentId, whatText, whoText, howText).then(onCreated).catch((caught: unknown) => setError(messageOf(caught)));
      }}
    >
      <label className="block text-sm font-medium">
        What
        <input className="mt-1 w-full rounded border border-stone-300 px-2 py-1 font-normal" value={whatText} onChange={(event) => setWhatText(event.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        Who
        <input className="mt-1 w-full rounded border border-stone-300 px-2 py-1 font-normal" value={whoText} onChange={(event) => setWhoText(event.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        How
        <input className="mt-1 w-full rounded border border-stone-300 px-2 py-1 font-normal" value={howText} onChange={(event) => setHowText(event.target.value)} />
      </label>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="w-fit rounded bg-stone-900 px-3 py-1 text-sm text-white" type="submit">
        Add control
      </button>
    </form>
  );
}

function DecisionForm({
  token,
  assessmentId,
  onCreated,
}: {
  token: string;
  assessmentId: string;
  onCreated: () => void;
}) {
  const [decision, setDecision] = useState<"accept" | "reject">("accept");
  const [durationText, setDurationText] = useState("one month or less");
  const [publicExposed, setPublicExposed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        api
          .addDecision(token, assessmentId, decision, durationText, publicExposed)
          .then(onCreated)
          .catch((caught: unknown) => setError(messageOf(caught)));
      }}
    >
      <Select label="Decision" value={decision} options={[["accept", "Accept"], ["reject", "Reject"]]} onChange={(value) => setDecision(value as "accept" | "reject")} />
      <Select
        label="Duration"
        value={durationText}
        options={[
          ["one month or less", "One month or less"],
          ["beyond one month", "Beyond one month"],
        ]}
        onChange={setDurationText}
      />
      <label className="text-sm">
        <input className="mr-2" type="checkbox" checked={publicExposed} onChange={(event) => setPublicExposed(event.target.checked)} />
        Public is exposed
      </label>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="rounded bg-stone-900 px-3 py-2 text-sm text-white" type="submit">
        Record decision
      </button>
    </form>
  );
}

function ActionForm({
  token,
  findingId,
  hazardId,
  users,
  onCreated,
}: {
  token: string;
  findingId: string;
  hazardId: string;
  users: OrgUser[];
  onCreated: () => void;
}) {
  const [description, setDescription] = useState("Label or dispose of the container.");
  const [ownerUserId, setOwnerUserId] = useState(users[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        api.addAction(token, findingId, hazardId, description, ownerUserId).then(onCreated).catch((caught: unknown) => setError(messageOf(caught)));
      }}
    >
      <label className="block text-sm font-medium">
        What will be done
        <input className="mt-1 w-full rounded border border-stone-300 px-2 py-1 font-normal" value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        Assigned person
        <select className="mt-1 w-full rounded border border-stone-300 px-2 py-1 font-normal" value={ownerUserId} onChange={(event) => setOwnerUserId(event.target.value)}>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.displayName}
          </option>
        ))}
      </select>
      </label>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white" type="submit">
        Assign action
      </button>
    </form>
  );
}

function EvidenceForm({ token, actionId, onCreated }: { token: string; actionId: string; onCreated: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const input = event.currentTarget.elements.namedItem("evidenceFile");
        const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
        if (!file) {
          setError("Choose a file");
          return;
        }
        if (file.size > 1_000_000) {
          setError("The evidence file must be 1 MB or smaller");
          return;
        }
        fileToBase64(file)
          .then((contentBase64) => api.addEvidence(token, actionId, file.name, contentBase64))
          .then(() => {
            if (input instanceof HTMLInputElement) {
              input.value = "";
            }
            onCreated();
          })
          .catch((caught: unknown) => setError(messageOf(caught)));
      }}
    >
      <label className="block text-sm font-medium">
        Evidence file
        <input className="mt-1 block font-normal" name="evidenceFile" type="file" />
      </label>
      <p className="text-sm text-stone-600">The record keeps the file name and a SHA-256 hash. The file itself is not stored.</p>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white" type="submit">
        Attach evidence
      </button>
    </form>
  );
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function VerifyForm({ token, actionId, onCreated }: { token: string; actionId: string; onCreated: () => void }) {
  const [notes, setNotes] = useState("Label is on the container.");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        api.verifyAction(token, actionId, "pass", notes).then(onCreated).catch((caught: unknown) => setError(messageOf(caught)));
      }}
    >
      <label className="block text-sm font-medium">
        Verification notes
        <input className="mt-1 w-full rounded border border-stone-300 px-2 py-1 font-normal" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <div className="flex gap-2">
        <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white" type="submit">
          Verify pass
        </button>
        <button
          className="rounded border border-stone-900 px-3 py-1 text-sm"
          type="button"
          onClick={() =>
            api.verifyAction(token, actionId, "fail", notes).then(onCreated).catch((caught: unknown) => setError(messageOf(caught)))
          }
        >
          Verify fail
        </button>
      </div>
    </form>
  );
}

function messageOf(caught: unknown): string {
  return caught instanceof Error ? caught.message : "Something went wrong";
}
