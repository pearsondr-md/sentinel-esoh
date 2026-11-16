import { useEffect, useState, type FormEvent } from "react";
import {
  api,
  type EmployeeReport,
  type FindingChain,
  type Inspection,
  type OrgUser,
  type OverdueAction,
  type Session,
  type WorkFinding,
} from "./api.ts";
import { EnvironmentalDetail, EnvironmentalLists, type EnvironmentalSelection } from "./Environmental.tsx";
import { ExposureDetail, ExposureLists } from "./OccupationalHealth.tsx";
import { AskView } from "./Ask.tsx";
import { AsohmsView } from "./Asohms.tsx";
import { CouncilView } from "./Council.tsx";
import { Bars, Flow } from "./Charts.tsx";

const PLACES = [
  {
    name: "Camp Sentinel",
    accounts: [
      ["Garrison", "garrison.safety@camp-sentinel.example", "Camp Sentinel Garrison Safety"],
      ["Shop 2 safety", "shop2.safety@camp-sentinel.example", "Shop 2 Safety Officer"],
      ["Shop 2 commander", "shop2.commander@camp-sentinel.example", "Shop 2 Commander"],
      ["Shop 2 supervisor", "shop2.supervisor@camp-sentinel.example", "Shop 2 Supervisor"],
      ["Shop 2 employee", "shop2.employee@camp-sentinel.example", "Shop 2 Employee"],
      ["Wash rack", "wash.safety@camp-sentinel.example", "Vehicle wash rack Safety Officer"],
      ["Dining facility", "dining.safety@camp-sentinel.example", "Dining facility Safety Officer"],
    ],
  },
  {
    name: "Camp Harrow",
    accounts: [
      ["Safety officer", "safety@camp-harrow.example", "Camp Harrow Safety Officer"],
      ["Commander", "commander@camp-harrow.example", "Camp Harrow Commander"],
      ["Supervisor", "supervisor@camp-harrow.example", "Camp Harrow Supervisor"],
      ["Employee", "employee@camp-harrow.example", "Camp Harrow Employee"],
    ],
  },
  {
    name: "Camp Meridian",
    accounts: [
      ["Safety officer", "safety@camp-meridian.example", "Camp Meridian Safety Officer"],
      ["Commander", "commander@camp-meridian.example", "Camp Meridian Commander"],
      ["Supervisor", "supervisor@camp-meridian.example", "Camp Meridian Supervisor"],
      ["Employee", "employee@camp-meridian.example", "Camp Meridian Employee"],
    ],
  },
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
const findingKey = "sentinel.finding";

const STEP_LABELS = ["Identify", "Assess", "Decide", "Assign", "Verify", "Close"] as const;
const STEP_WHO = ["Safety officer", "Safety officer", "Commander", "Safety officer", "Supervisor", "Safety officer"] as const;

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
      <header className="border-b border-[#e4c27a] bg-[#2c261f] text-[#fffdf8]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <p className="text-xs font-semibold tracking-widest text-[#e4c27a]">CAMP SENTINEL</p>
              <h1 className="text-2xl font-semibold leading-none">SENTINEL</h1>
            </div>
          </div>
          {session ? (
            <div className="text-right">
              <p className="font-medium">{session.displayName}</p>
              <LocationSwitch displayName={session.displayName} onSignIn={signIn} />
              <button className="mt-2 text-sm text-[#e4c27a] underline" type="button" onClick={signOut}>
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        {session ? <Workspace session={session} /> : <SignIn onSignIn={signIn} />}
      </main>
    </div>
  );
}

function LocationSwitch({ displayName, onSignIn }: { displayName: string; onSignIn: (session: Session) => void }) {
  const current = PLACES.find((place) => place.accounts.some((account) => account[2] === displayName)) ?? PLACES[0];
  const [placeName, setPlaceName] = useState<string>(current.name);
  useEffect(() => {
    setPlaceName(current.name);
  }, [current.name]);
  const place = PLACES.find((item) => item.name === placeName) ?? current;
  return (
    <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
      <label className="text-sm">
        <span className="sr-only">Location</span>
        <select className="rounded-full bg-[#fffdf8] px-2 py-1 text-[#2c261f]" value={place.name} onChange={(event) => setPlaceName(event.target.value)}>
          {PLACES.map((item) => (
            <option key={item.name}>{item.name}</option>
          ))}
        </select>
      </label>
      {place.accounts.map(([label, email, name]) => (
        <button
          key={email}
          className={displayName === name ? "chip-on" : "chip"}
          type="button"
          onClick={() => {
            api.signIn(email, "camp-sentinel-demo").then(onSignIn).catch(() => undefined);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SignIn({ onSignIn }: { onSignIn: (session: Session) => void }) {
  const [email, setEmail] = useState("shop2.safety@camp-sentinel.example");
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
      <button className="btn" type="submit">
        Sign in
      </button>
      <div className="space-y-3 pt-4 text-sm text-stone-600">
        {PLACES.map((place) => (
          <div key={place.name}>
            <p>{place.name}</p>
            {place.accounts.map(([label, account]) => (
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
        ))}
      </div>
    </form>
  );
}

type Place = "home" | "council" | "asohms" | "ask" | "environment" | "exposure" | "reports";

function Workspace({ session }: { session: Session }) {
  const [reports, setReports] = useState<EmployeeReport[]>([]);
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [environmental, setEnvironmental] = useState<EnvironmentalSelection | null>(null);
  const [exposureId, setExposureId] = useState<string | null>(null);
  const [place, setPlace] = useState<Place>("home");
  const [backPlace, setBackPlace] = useState<Place>("home");
  const [reportFilter, setReportFilter] = useState<string | null>(null);
  const [findingId, setFindingId] = useState<string | null>(() => sessionStorage.getItem(findingKey));
  const [work, setWork] = useState<{ inspections: Inspection[]; findings: WorkFinding[]; overdue: OverdueAction[] }>({
    inspections: [],
    findings: [],
    overdue: [],
  });
  const [error, setError] = useState<string | null>(null);

  function openFinding(id: string, back: Place = place) {
    sessionStorage.setItem(findingKey, id);
    setFindingId(id);
    setBackPlace(back);
  }

  function closeDetail() {
    sessionStorage.removeItem(findingKey);
    setFindingId(null);
    setInspectionId(null);
    setPlace(backPlace);
  }

  function goHome() {
    sessionStorage.removeItem(findingKey);
    setFindingId(null);
    setInspectionId(null);
    setReportId(null);
    setEnvironmental(null);
    setExposureId(null);
    setPlace("home");
  }

  async function refresh() {
    const [nextWork, nextReports] = await Promise.all([api.work(session.token), api.reports(session.token)]);
    setWork(nextWork);
    setReports(nextReports.employeeReports);
  }

  useEffect(() => {
    refresh().catch((caught: unknown) => setError(messageOf(caught)));
  }, [session.token]);

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2" aria-label="Sections">
        <button className={place === "home" && !findingId && !inspectionId ? "btn" : "btn-quiet"} type="button" onClick={goHome}>
          Overview
        </button>
        {(
          [
            ["council", "Council"],
            ["asohms", "Practice notes"],
            ["ask", "Ask"],
            ["environment", "Environment"],
            ["exposure", "Health"],
            ["reports", "Reports"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            className={place === value ? "btn" : "btn-quiet"}
            type="button"
            onClick={() => {
              setPlace(value);
              setFindingId(null);
              sessionStorage.removeItem(findingKey);
              setInspectionId(null);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      {findingId ? (
        <FindingRecord session={session} findingId={findingId} onBack={closeDetail} />
      ) : inspectionId ? (
        <InspectionDetail session={session} inspectionId={inspectionId} onSelectFinding={openFinding} onBack={closeDetail} />
      ) : place === "council" ? (
        <CouncilView
          session={session}
          onOpenFinding={(id) => openFinding(id, "council")}
          onOpenInspection={(id) => {
            setBackPlace("council");
            setInspectionId(id);
          }}
          onOpenEnvironment={(selection) => {
            setFindingId(null);
            sessionStorage.removeItem(findingKey);
            setEnvironmental(selection);
            setPlace("environment");
          }}
          onOpenExposure={(id) => {
            setFindingId(null);
            sessionStorage.removeItem(findingKey);
            setExposureId(id);
            setPlace("exposure");
          }}
        />
      ) : place === "asohms" ? (
        <AsohmsView session={session} />
      ) : place === "ask" ? (
        <AskView session={session} findingId={null} />
      ) : place === "environment" ? (
        <div className="space-y-6">
          <EnvironmentalLists session={session} selected={environmental} onSelect={setEnvironmental} />
          {environmental ? (
            <EnvironmentalDetail session={session} selection={environmental} onSelectFinding={openFinding} />
          ) : (
            <p className="text-sm text-[#6d6256]">No environmental record is open. Add an obligation, a waste stream, or a spill, then open a finding from it.</p>
          )}
        </div>
      ) : place === "exposure" ? (
        <div className="space-y-6">
          <ExposureLists session={session} selectedId={exposureId} onSelect={setExposureId} />
          {exposureId ? (
            <ExposureDetail session={session} groupId={exposureId} />
          ) : (
            <p className="text-sm text-[#6d6256]">No exposure group is open. Add a group for a shop, an agent, and a headcount.</p>
          )}
        </div>
      ) : place === "reports" ? (
        <div className="space-y-6">
          <section className="panel">
            <h2 className="text-2xl font-semibold">Written reports</h2>
            <p className="mt-1 text-sm text-[#6d6256]">File what you saw. The shared log can leave your name off.</p>
            <div className="mt-4">
              <Bars
                selected={reportFilter}
                onSelect={setReportFilter}
                items={[
                  { key: "named", label: "Name on the log", value: reports.filter((report) => report.showName).length, tone: "#3d342b" },
                  { key: "withheld", label: "Name withheld", value: reports.filter((report) => !report.showName).length, tone: "#b8893a" },
                ]}
              />
            </div>
            {reports.length === 0 ? <p className="mt-3 text-sm text-[#6d6256]">No written report yet.</p> : null}
            <ul className="mt-3 space-y-2">
              {reports
              .filter((report) => (reportFilter === "named" ? report.showName : reportFilter === "withheld" ? !report.showName : true))
              .map((report) => (
                <li key={report.id}>
                  <button className="panel w-full text-left" type="button" onClick={() => setReportId(report.id)}>
                    <span className="text-xs font-semibold tracking-wide text-[#8a6a32]">
                      {report.showName && report.reporterDisplayName ? report.reporterDisplayName : "Name withheld"}
                    </span>
                    <span className="mt-1 block">{report.text}</span>
                    <span className="mt-1 block text-sm text-[#6d6256]">Open this report.</span>
                  </button>
                </li>
              ))}
            </ul>
            <ReportForm
              token={session.token}
              onCreated={(report) => {
                setReportId(report.id);
                refresh().catch((caught: unknown) => setError(messageOf(caught)));
              }}
            />
          </section>
          {reportId ? <ReportDetail session={session} reportId={reportId} onSelectFinding={openFinding} /> : null}
        </div>
      ) : (
        <Home
          session={session}
          work={work}
          reports={reports}
          onOpenInspection={(id) => setInspectionId(id)}
          onOpenFinding={openFinding}
          onOpenReport={(id) => {
            setReportId(id);
            setPlace("reports");
          }}
          onCreated={() => refresh().catch((caught: unknown) => setError(messageOf(caught)))}
        />
      )}
    </div>
  );
}

function Home({
  session,
  work,
  reports,
  onOpenInspection,
  onOpenFinding,
  onOpenReport,
  onCreated,
}: {
  session: Session;
  work: { inspections: Inspection[]; findings: WorkFinding[]; overdue: OverdueAction[] };
  reports: EmployeeReport[];
  onOpenInspection: (id: string) => void;
  onOpenFinding: (id: string) => void;
  onOpenReport: (id: string) => void;
  onCreated: () => void;
}) {
  const safety = session.roles.includes("safety officer");
  const identify = work.inspections.filter((inspection) => !work.findings.some((finding) => finding.inspectionId === inspection.id));
  const count = (step: WorkFinding["step"]) => work.findings.filter((finding) => finding.step === step).length;
  const named = reports.filter((report) => report.showName).length;
  const [windowKey, setWindowKey] = useState<string | null>(null);
  const lanes = [
    {
      role: "Safety officer",
      active: safety,
      talk: "Starts the inspection, names the hazard, records the matrix, assigns the action, and closes it.",
      findings: work.findings.filter((finding) => finding.step === "assess" || finding.step === "assign" || finding.step === "close"),
    },
    {
      role: "Commander",
      active: session.roles.includes("commander"),
      talk: "Accepts or rejects the residual risk. A blocked authority check does not stop the action.",
      findings: work.findings.filter((finding) => finding.step === "decide" || finding.authorityResult === "blocked"),
    },
    {
      role: "Supervisor",
      active: session.roles.includes("supervisor"),
      talk: "Finishes the assigned work and attaches evidence. Someone else verifies it.",
      findings: work.findings.filter((finding) => finding.step === "verify"),
    },
    {
      role: "Employee",
      active: !safety && !session.roles.includes("commander") && !session.roles.includes("supervisor"),
      talk: "Files a written report. The name can stay off the shared log.",
      findings: [] as WorkFinding[],
    },
  ];

  const opened = windowKey ? overviewWindow(windowKey, work, identify, reports) : null;
  if (opened) {
    return (
      <section className="space-y-4">
        <div className="panel">
          <button className="text-sm text-[#8a6a32] underline" type="button" onClick={() => setWindowKey(null)}>
            Back to overview
          </button>
          <h2 className="mt-2 text-2xl font-semibold">{opened.title}</h2>
          <p className="mt-1 text-[#5c5348]">{opened.note}</p>
        </div>
        <ul className="space-y-3">
          {opened.rows.map((row) => (
            <li key={row.id}>
              <button
                className="panel w-full text-left"
                type="button"
                onClick={() => {
                  if (row.kind === "inspection") onOpenInspection(row.id);
                  if (row.kind === "finding") onOpenFinding(row.id);
                  if (row.kind === "report") onOpenReport(row.id);
                }}
              >
                <span className="text-xs font-semibold tracking-wide text-[#8a6a32]">{row.meta}</span>
                <span className="mt-1 block font-medium">{row.label}</span>
                <span className="mt-1 block text-sm text-[#6d6256]">Open this record.</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="panel">
        <h2 className="text-2xl font-semibold">{session.displayName}</h2>
        <p className="mt-2 max-w-2xl text-[#5c5348]">
          These records belong to this location. Choose another camp or shop in the header to see that place's work. A count across camps is not a score.
        </p>
        {work.overdue.length > 0 ? (
          <div className="mt-4">
            <h3 className="font-semibold">Past due</h3>
            <ul className="mt-2 space-y-2">
              {work.overdue.map((action) => (
                <li key={action.id}>
                  <button className="text-left" type="button" onClick={() => onOpenFinding(action.findingId)}>
                    <span className="font-medium">{action.description}</span>
                    <span className="mt-1 block text-sm text-[#6d6256]">Due {action.dueOn}. Open the finding.</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-5 overflow-x-auto">
          <Flow
            onSelect={setWindowKey}
            steps={[
              { key: "identify", label: "Identify", who: "Safety officer", value: identify.length },
              { key: "assess", label: "Assess", who: "Safety officer", value: count("assess") },
              { key: "decide", label: "Decide", who: "Commander", value: count("decide") },
              { key: "assign", label: "Assign", who: "Safety officer", value: count("assign") },
              { key: "verify", label: "Verify", who: "Supervisor", value: count("verify") },
              { key: "closing", label: "Close", who: "Safety officer", value: count("close") + count("done") },
            ]}
          />
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel">
          <h3 className="font-semibold">Findings by step</h3>
          <div className="mt-4">
            <Bars
              onSelect={setWindowKey}
              items={[
                { key: "assess", label: "Assess", value: count("assess"), tone: "#3d342b" },
                { key: "decide", label: "Decide", value: count("decide"), tone: "#8a6a32" },
                { key: "assign", label: "Assign", value: count("assign"), tone: "#b8893a" },
                { key: "verify", label: "Verify", value: count("verify"), tone: "#c4a15a" },
                { key: "close", label: "Close", value: count("close"), tone: "#7d8a62" },
                { key: "done", label: "Closed", value: count("done"), tone: "#5f6b4c" },
              ]}
            />
          </div>
        </section>
        <section className="panel">
          <h3 className="font-semibold">Written reports</h3>
          <div className="mt-4">
            <Bars
              onSelect={setWindowKey}
              items={[
                { key: "named", label: "Name on the log", value: named, tone: "#3d342b" },
                { key: "withheld", label: "Name withheld", value: reports.length - named, tone: "#b8893a" },
              ]}
            />
          </div>
          <p className="mt-3 text-sm text-[#6d6256]">{reports.length} report{reports.length === 1 ? "" : "s"} on the shared log.</p>
        </section>
      </div>
      <SiteCounts findings={work.findings} onOpen={(key) => setWindowKey(key)} />
      {session.roles.includes("safety officer") || session.roles.includes("commander") ? <CampCounts token={session.token} /> : null}
      {safety ? <ChecklistWalk token={session.token} onOpenFinding={onOpenFinding} onCreated={onCreated} /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {lanes.map((lane) => (
          <section key={lane.role} className={`panel ${lane.active ? "ring-2 ring-[#e4c27a]" : ""}`}>
            <h3 className="font-semibold">{lane.role}</h3>
            <p className="mt-1 text-sm text-[#6d6256]">{lane.talk}</p>
            {lane.role === "Safety officer" && identify.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {identify.map((inspection) => (
                  <li key={inspection.id}>
                    <button className="text-left" type="button" onClick={() => onOpenInspection(inspection.id)}>
                      <span className="text-xs font-semibold tracking-wide text-[#8a6a32]">Identify</span>
                      <span className="block">{inspection.shopName} · {inspection.inspectedOn}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {lane.role === "Employee" ? (
              <ul className="mt-3 space-y-2">
                {reports.length === 0 ? <li className="text-sm text-[#6d6256]">No written report yet.</li> : null}
                {reports.map((report) => (
                  <li key={report.id}>
                    <button className="text-left" type="button" onClick={() => onOpenReport(report.id)}>
                      <span className="text-xs font-semibold tracking-wide text-[#8a6a32]">
                        {report.showName && report.reporterDisplayName ? report.reporterDisplayName : "Name withheld"}
                      </span>
                      <span className="block">{report.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : lane.findings.length === 0 ? (
              <p className="mt-3 text-sm text-[#6d6256]">Nothing is waiting in this lane.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {lane.findings.map((finding) => (
                  <li key={`${lane.role}-${finding.id}`}>
                    <button className="text-left" type="button" onClick={() => onOpenFinding(finding.id)}>
                      <span className="text-xs font-semibold tracking-wide text-[#8a6a32]">{stepTitle(finding.step)}</span>
                      <span className="block">{finding.originalText}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {lane.role === "Safety officer" && safety ? (
              <NewInspection
                token={session.token}
                onCreated={(inspection) => {
                  onOpenInspection(inspection.id);
                  onCreated();
                }}
              />
            ) : null}
            {lane.role === "Employee" ? <ReportForm token={session.token} onCreated={() => onCreated()} /> : null}
          </section>
        ))}
      </div>
    </div>
  );
}

function overviewWindow(
  key: string,
  work: { findings: WorkFinding[] },
  identify: Inspection[],
  reports: EmployeeReport[],
): { title: string; note: string; rows: Array<{ id: string; kind: "inspection" | "finding" | "report"; label: string; meta: string }> } | null {
  if (key.startsWith("site:")) {
    const name = key.slice("site:".length);
    return {
      title: name,
      note: "Findings at this place. Another camp's words are not in this list.",
      rows: work.findings
        .filter((finding) => finding.organizationName === name)
        .map((finding) => ({
          id: finding.id,
          kind: "finding" as const,
          label: finding.originalText,
          meta: stepTitle(finding.step),
        })),
    };
  }
  if (key === "identify") {
    return {
      title: "Identify",
      note: "Inspections that do not have a finding yet.",
      rows: identify.map((inspection) => ({
        id: inspection.id,
        kind: "inspection",
        label: `${inspection.shopName} · ${inspection.inspectedOn}`,
        meta: "Inspection",
      })),
    };
  }
  if (key === "named" || key === "withheld") {
    const shown = reports.filter((report) => (key === "named" ? report.showName : !report.showName));
    return {
      title: key === "named" ? "Name on the log" : "Name withheld",
      note: "Written reports in this group.",
      rows: shown.map((report) => ({
        id: report.id,
        kind: "report",
        label: report.text,
        meta: report.showName && report.reporterDisplayName ? report.reporterDisplayName : "Name withheld",
      })),
    };
  }
  const findings = work.findings.filter((finding) =>
    key === "closing" ? finding.step === "close" || finding.step === "done" : finding.step === key,
  );
  if (!["assess", "decide", "assign", "verify", "close", "closing", "done"].includes(key)) {
    return null;
  }
  return {
    title: key === "closing" ? "Close" : stepTitle(key as WorkFinding["step"]),
    note: "Each row is a finding at this step.",
    rows: findings.map((finding) => ({
      id: finding.id,
      kind: "finding" as const,
      label: finding.originalText,
      meta: stepTitle(finding.step),
    })),
  };
}

function SiteCounts({ findings, onOpen }: { findings: WorkFinding[]; onOpen: (key: string) => void }) {
  const names = [...new Set(findings.map((finding) => finding.organizationName).filter((name): name is string => Boolean(name)))];
  if (names.length < 2) return null;
  return (
    <section className="panel">
      <h3 className="font-semibold">Places in this account</h3>
      <p className="mt-1 text-sm text-[#6d6256]">Each place is a count of findings you can already open.</p>
      <div className="mt-4">
        <Bars
          onSelect={onOpen}
          items={names.map((name) => ({
            key: `site:${name}`,
            label: name,
            value: findings.filter((finding) => finding.organizationName === name).length,
          }))}
        />
      </div>
    </section>
  );
}

function CampCounts({ token }: { token: string }) {
  const [camps, setCamps] = useState<Array<{ name: string; steps: Record<string, number>; overdueActions: number }>>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    api.comparison(token).then((body) => {
      setCamps(body.camps);
      setNotice(body.notice);
    }).catch(() => undefined);
  }, [token]);
  if (camps.length === 0) return null;
  const steps = ["assess", "decide", "assign", "verify", "close", "done"];
  return (
    <section className="panel">
      <h3 className="font-semibold">Camps</h3>
      <p className="mt-1 text-sm text-[#6d6256]">{notice}</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[#6d6256]">
              <th className="py-2 pr-3 font-medium">Camp</th>
              {steps.map((step) => (
                <th key={step} className="px-2 py-2 font-medium capitalize">{step === "done" ? "Closed" : step}</th>
              ))}
              <th className="px-2 py-2 font-medium">Past due</th>
            </tr>
          </thead>
          <tbody>
            {camps.map((camp) => (
              <tr key={camp.name} className="border-t border-[#eadfce]">
                <th className="py-2 pr-3 font-medium">{camp.name}</th>
                {steps.map((step) => (
                  <td key={step} className="px-2 py-2 tabular-nums">{camp.steps[step] ?? 0}</td>
                ))}
                <td className="px-2 py-2 tabular-nums">{camp.overdueActions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ChecklistWalk({
  token,
  onOpenFinding,
  onCreated,
}: {
  token: string;
  onOpenFinding: (id: string) => void;
  onCreated: () => void;
}) {
  const [checklists, setChecklists] = useState<Array<{ id: string; title: string; shopName: string; items: Array<{ id: string; text: string }> }>>([]);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [checklistId, setChecklistId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([api.checklists(token), api.organizations(token)]).then(([lists, orgs]) => {
      setChecklists(lists.checklists);
      setOrganizations(orgs.organizations);
      setChecklistId(lists.checklists[0]?.id ?? "");
      setOrganizationId(orgs.organizations[0]?.id ?? "");
    }).catch((caught: unknown) => setError(messageOf(caught)));
  }, [token]);
  const checklist = checklists.find((item) => item.id === checklistId);
  const ready = checklist ? checklist.items.every((item) => item.id in answers) : false;
  return (
    <section className="panel">
      <h3 className="font-semibold">Walk</h3>
      <p className="mt-1 text-sm text-[#6d6256]">Pass or fail each line. A fail is saved as a finding in the words on the line.</p>
      <label className="mt-3 block text-sm">
        List
        <select className="field" value={checklistId} onChange={(event) => { setChecklistId(event.target.value); setAnswers({}); }}>
          {checklists.map((item) => (
            <option key={item.id} value={item.id}>{item.title}</option>
          ))}
        </select>
      </label>
      {organizations.length > 1 ? (
        <label className="mt-3 block text-sm">
          Place
          <select className="field" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </label>
      ) : null}
      <ul className="mt-4 space-y-3">
        {checklist?.items.map((item) => (
          <li key={item.id} className="rounded-2xl bg-[#f6f0e6] px-3 py-3">
            <p>{item.text}</p>
            <div className="mt-2 flex gap-2">
              <button className={answers[item.id] === true ? "btn" : "btn-quiet"} type="button" onClick={() => setAnswers({ ...answers, [item.id]: true })}>Pass</button>
              <button className={answers[item.id] === false ? "btn" : "btn-quiet"} type="button" onClick={() => setAnswers({ ...answers, [item.id]: false })}>Fail</button>
            </div>
          </li>
        ))}
      </ul>
      {error ? <p className="mt-2 text-sm text-red-800">{error}</p> : null}
      <button
        className="btn mt-4"
        type="button"
        disabled={!ready}
        onClick={() => {
          if (!checklist) return;
          api.checklistWalk(
            token,
            checklist.id,
            new Date().toISOString().slice(0, 10),
            organizationId,
            checklist.items.map((item) => ({ itemId: item.id, passed: answers[item.id] === true })),
          ).then((result) => {
            onCreated();
            const first = result.findings[0];
            if (first) onOpenFinding(first.id);
          }).catch((caught: unknown) => setError(messageOf(caught)));
        }}
      >
        Save the walk
      </button>
    </section>
  );
}

function stepTitle(step: WorkFinding["step"]): string {
  if (step === "assess") return "Assess";
  if (step === "decide") return "Decide";
  if (step === "assign") return "Assign";
  if (step === "verify") return "Verify";
  if (step === "close") return "Close";
  return "Closed";
}

function InspectionDetail({
  session,
  inspectionId,
  onSelectFinding,
  onBack,
}: {
  session: Session;
  inspectionId: string;
  onSelectFinding: (id: string) => void;
  onBack: () => void;
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
      <div className="panel">
        <button className="text-sm text-[#8a6a32] underline" type="button" onClick={onBack}>Back to your work</button>
        <h2 className="mt-2 text-2xl font-semibold">Identify · {detail.inspection.shopName}</h2>
        <p className="text-[#6d6256]">
          {detail.inspection.inspectedOn}. Write the observation, then the finding. The finding words stay as first written.
        </p>
      </div>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <div className="space-y-3">
        {detail.observations.map((observation) => (
          <article key={observation.id} className="panel">
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
    </section>
  );
}

function FindingRecord({ session, findingId, onBack }: { session: Session; findingId: string; onBack: () => void }) {
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
  const step = chainStep(chain);
  const active = step === "done" ? STEP_LABELS.length : STEP_LABELS.indexOf(stepLabel(step));

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className="text-sm text-[#8a6a32] underline" type="button" onClick={onBack}>Back to your work</button>
        <p className="text-sm text-[#6d6256]">Switch accounts in the header. This finding stays open.</p>
      </div>
      <ol className="grid gap-2 sm:grid-cols-6" aria-label="Finding steps">
        {STEP_LABELS.map((label, index) => {
          const state = index < active ? "Done" : index === active ? "Now" : "Later";
          return (
            <li
              key={label}
              className={`rounded-2xl px-3 py-2 text-sm ${index === active ? "bg-[#fffdf8] shadow-sm ring-2 ring-[#e4c27a]" : index < active ? "bg-[#efe6d6]" : "bg-[#e7e0d4] text-[#6d6256]"}`}
            >
              <span className="block text-xs tracking-wide">{state}</span>
              {label}
              <span className="block text-xs text-[#6d6256]">{STEP_WHO[index]}</span>
            </li>
          );
        })}
      </ol>
      <article className="panel">
        <h3 className="font-semibold">Identify</h3>
        <p className="mt-2">{chain.finding.originalText}</p>
        <p className="mt-2 text-sm text-[#6d6256]">These words stay on the record. Status: {chain.finding.status}.</p>
      </article>

      <article className="panel">
        <h3 className="font-semibold">Assess · safety officer</h3>
        {hazard ? <p className="mt-2">Hazard: {hazard.description}</p> : <p className="mt-2 text-[#6d6256]">Name the hazard.</p>}
        {step === "assess" && safety && !hazard ? (
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
        canEstimate={step === "assess" && safety && Boolean(hazard) && !initial}
        onEstimate={async (probabilityCode, severityCode) => {
          if (!hazard) return;
          await api.addAssessment(session.token, hazard.id, "initial", probabilityCode, severityCode);
          await reload();
        }}
      />
      <AssessmentBlock
        title="Residual risk"
        assessment={residual}
        canEstimate={step === "assess" && safety && Boolean(initial) && !residual}
        onEstimate={async (probabilityCode, severityCode) => {
          if (!hazard) return;
          await api.addAssessment(session.token, hazard.id, "residual", probabilityCode, severityCode);
          await reload();
        }}
      />

      {residual && (step === "assess" || chain.controls.length > 0) ? (
        <article className="panel">
          <h3 className="font-semibold">Controls</h3>
          <ul className="mt-2 space-y-2">
            {chain.controls.map((control) => (
              <li key={control.id}>
                {control.whatText} {control.whoText} {control.howText}
              </li>
            ))}
          </ul>
          {step === "assess" && safety ? (
            <ControlForm
              token={session.token}
              assessmentId={residual.id}
              onCreated={() => reload().catch((caught: unknown) => setError(messageOf(caught)))}
            />
          ) : null}
        </article>
      ) : null}

      <article className="panel">
        <h3 className="font-semibold">Decide · commander</h3>
        <p className="mt-1 text-sm text-[#6d6256]">Accept or reject. The authority check is a separate result. A blocked acceptance still leaves the action free to assign.</p>
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
        {step === "decide" && commander && residual ? (
          <DecisionForm
            token={session.token}
            assessmentId={residual.id}
            onCreated={() => reload().catch((caught: unknown) => setError(messageOf(caught)))}
          />
        ) : null}
      </article>

      <article className="panel">
        <h3 className="font-semibold">Assign, verify, close</h3>
        <p className="mt-1 text-sm text-[#6d6256]">The safety officer assigns it. The supervisor finishes it. Someone else verifies it. The safety officer closes it.</p>
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
                  className="btn mt-2"
                  type="button"
                  onClick={() =>
                    api.completeAction(session.token, action.id).then(reload).catch((caught: unknown) => setError(messageOf(caught)))
                  }
                >
                  Mark the work complete
                </button>
              ) : null}
              {step === "verify" && action.completedBy && action.completedBy !== session.userId && action.status === "completed" ? (
                <VerifyForm
                  token={session.token}
                  actionId={action.id}
                  onCreated={() => reload().catch((caught: unknown) => setError(messageOf(caught)))}
                />
              ) : null}
              {step === "close" && safety && action.status === "completed" ? (
                <button
                  className="btn-quiet mt-2"
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
        {step === "assign" && safety && hazard ? (
          <ActionForm
            token={session.token}
            findingId={findingId}
            hazardId={hazard.id}
            users={users}
            onCreated={() => reload().catch((caught: unknown) => setError(messageOf(caught)))}
          />
        ) : null}
      </article>
      <article className="panel">
        <h3 className="font-semibold">Work authorization</h3>
        <p className="mt-1 text-sm text-[#6d6256]">Who may do this task. This is not a risk acceptance and it does not change the matrix.</p>
        <ul className="mt-2 space-y-2">
          {chain.authorizations.map((item) => (
            <li key={item.id}>{item.taskName}. {item.note} Authorized by {item.authorizedBy}.</li>
          ))}
        </ul>
        {safety ? (
          <AuthorizationForm
            token={session.token}
            findingId={findingId}
            onCreated={() => reload().catch((caught: unknown) => setError(messageOf(caught)))}
          />
        ) : null}
      </article>
      <details className="panel">
        <summary className="cursor-pointer font-semibold">Ask about this finding</summary>
        <div className="mt-4">
          <AskView session={session} findingId={findingId} />
        </div>
      </details>
    </div>
  );
}

function chainStep(chain: FindingChain): WorkFinding["step"] {
  const initial = chain.assessments.some((assessment) => assessment.phase === "initial");
  const residual = chain.assessments.some((assessment) => assessment.phase === "residual");
  const action = chain.actions[0];
  const passed = chain.verifications.some((verification) => verification.result === "pass");
  if (!chain.hazards[0] || !initial || !residual || chain.controls.length === 0) return "assess";
  if (chain.decisions.length === 0) return "decide";
  if (!action) return "assign";
  if (action.status === "open" || !passed) return "verify";
  if (action.status !== "closed") return "close";
  return "done";
}

function stepLabel(step: WorkFinding["step"]): (typeof STEP_LABELS)[number] {
  if (step === "assess") return "Assess";
  if (step === "decide") return "Decide";
  if (step === "assign") return "Assign";
  if (step === "verify") return "Verify";
  if (step === "close") return "Close";
  return "Close";
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
    <article className="panel">
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
          <button className="btn" type="submit">
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
      <button className="btn" type="submit">
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
      <button className="btn" type="submit">
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
      <button className="btn" type="submit">
        File report
      </button>
    </form>
  );
}

function ReportDetail({
  session,
  reportId,
  onSelectFinding,
}: {
  session: Session;
  reportId: string;
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
      <article className="panel">
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
    </section>
  );
}

function LibraryPick({ token, onPick }: { token: string; onPick: (text: string) => void }) {
  const [entries, setEntries] = useState<Array<{ id: string; kind: string; name: string; note: string }>>([]);
  useEffect(() => {
    api.library(token).then((body) => setEntries(body.entries)).catch(() => undefined);
  }, [token]);
  if (entries.length === 0) return null;
  return (
    <label className="block text-sm">
      Chemical or job step
      <select
        className="field"
        defaultValue=""
        onChange={(event) => {
          const entry = entries.find((item) => item.id === event.target.value);
          if (entry) onPick(entry.name);
        }}
      >
        <option value="">Type the words, or start from a name</option>
        {entries.map((entry) => (
          <option key={entry.id} value={entry.id}>{entry.kind === "chemical" ? "Chemical" : "Job"} · {entry.name}</option>
        ))}
      </select>
      <span className="mt-1 block text-xs text-[#6d6256]">A name fills the box. It does not set a risk level, and a safety data sheet is not stored.</span>
    </label>
  );
}

function AuthorizationForm({ token, findingId, onCreated }: { token: string; findingId: string; onCreated: () => void }) {
  const [taskName, setTaskName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        api.authorizeWork(token, findingId, taskName, note).then(() => {
          setTaskName("");
          setNote("");
          onCreated();
        }).catch((caught: unknown) => setError(messageOf(caught)));
      }}
    >
      <label className="block text-sm">
        Task
        <input className="field" value={taskName} onChange={(event) => setTaskName(event.target.value)} />
      </label>
      <label className="block text-sm">
        Note
        <input className="field" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="btn" type="submit">Record the authorization</button>
    </form>
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
      <LibraryPick token={token} onPick={setOriginalText} />
      <label className="block text-sm font-medium">
        Finding text, saved as first written
        <textarea className="mt-1 w-full rounded border border-stone-300 px-3 py-2 font-normal" value={originalText} onChange={(event) => setOriginalText(event.target.value)} />
      </label>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="btn" type="submit">
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
      <LibraryPick token={token} onPick={setDescription} />
      <label className="block text-sm font-medium">
        Hazard
        <textarea className="mt-1 w-full rounded border border-stone-300 px-3 py-2 font-normal" value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="btn" type="submit">
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
      <button className="btn" type="submit">
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
      <button className="btn" type="submit">
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
      <button className="btn" type="submit">
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
      <button className="btn" type="submit">
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
        <button className="btn" type="submit">
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
