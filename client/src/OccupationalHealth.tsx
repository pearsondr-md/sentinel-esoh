import { useEffect, useState, type FormEvent } from "react";
import { api, type ExposureGroup, type Session } from "./api.ts";

export function ExposureLists({
  session,
  selectedId,
  onSelect,
}: {
  session: Session;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [groups, setGroups] = useState<ExposureGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const safety = session.roles.includes("safety officer");

  async function reload() {
    const body = await api.exposureGroups(session.token);
    setGroups(body.exposureGroups);
  }

  useEffect(() => {
    reload().catch((caught: unknown) => setError(messageOf(caught)));
  }, [session.token]);

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Occupational health</h2>
      <p className="mb-3 text-sm text-stone-600">
        Exposure groups are counts for a shop. Names, diagnoses, and exam results are not stored.
      </p>
      {error ? <p className="mb-3 text-sm text-red-800">{error}</p> : null}
      <ul className="space-y-2">
        {groups.map((group) => (
          <li key={group.id}>
            <button
              className={`w-full rounded border px-3 py-2 text-left ${group.id === selectedId ? "border-stone-900 bg-white" : "border-stone-300 bg-stone-50"}`}
              type="button"
              onClick={() => onSelect(group.id)}
            >
              <span className="block font-medium">{group.agent}</span>
              <span className="text-sm text-stone-600">
                {group.shop} · {group.headcount} people
              </span>
            </button>
          </li>
        ))}
      </ul>
      {safety ? (
        <ExposureForm
          token={session.token}
          onCreated={(group) => {
            onSelect(group.id);
            reload().catch((caught: unknown) => setError(messageOf(caught)));
          }}
        />
      ) : null}
    </div>
  );
}

export function ExposureDetail({ session, groupId }: { session: Session; groupId: string }) {
  const [group, setGroup] = useState<ExposureGroup | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .exposureGroup(session.token, groupId)
      .then((body) => setGroup(body.exposureGroup))
      .catch((caught: unknown) => setError(messageOf(caught)));
  }, [groupId, session.token]);

  if (!group) {
    return <p>{error ?? "Loading the exposure group."}</p>;
  }

  return (
    <article className="rounded border border-stone-300 bg-white p-4">
      <h2 className="text-2xl font-semibold">{group.agent}</h2>
      <p className="mt-2">{group.shop}</p>
      <dl className="mt-3 space-y-1">
        <div>
          <dt className="text-sm text-stone-600">Control method</dt>
          <dd>{group.controlMethod}</dd>
        </div>
        <div>
          <dt className="text-sm text-stone-600">People in the group</dt>
          <dd>{group.headcount}</dd>
        </div>
        <div>
          <dt className="text-sm text-stone-600">Percent of required exams complete</dt>
          <dd>{group.examCompletionPercent}</dd>
        </div>
      </dl>
      {error ? <p className="mt-2 text-sm text-red-800">{error}</p> : null}
      <p className="mt-3 text-sm text-stone-600">This is a program count. It is not a medical record.</p>
    </article>
  );
}

function ExposureForm({ token, onCreated }: { token: string; onCreated: (group: ExposureGroup) => void }) {
  const [agent, setAgent] = useState("");
  const [shop, setShop] = useState("Shop 2");
  const [controlMethod, setControlMethod] = useState("");
  const [headcount, setHeadcount] = useState("4");
  const [examCompletionPercent, setExamCompletionPercent] = useState("75");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const people = Number(headcount);
    const percent = Number(examCompletionPercent);
    if (!Number.isInteger(people) || people < 0) {
      setError("People in the group must be a whole number");
      return;
    }
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      setError("Exam completion must be from 0 to 100");
      return;
    }
    api
      .createExposureGroup(token, agent, shop, controlMethod, people, percent)
      .then(onCreated)
      .catch((caught: unknown) => setError(messageOf(caught)));
  }

  return (
    <form className="mt-4 space-y-2" onSubmit={submit}>
      <h3 className="font-medium">Add an exposure group</h3>
      <Field label="Agent" value={agent} onChange={setAgent} />
      <Field label="Shop" value={shop} onChange={setShop} />
      <Field label="Control method" value={controlMethod} onChange={setControlMethod} />
      <Field label="People in the group" value={headcount} onChange={setHeadcount} />
      <Field label="Percent of required exams complete" value={examCompletionPercent} onChange={setExamCompletionPercent} />
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white" type="submit">
        Save exposure group
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

function messageOf(caught: unknown): string {
  return caught instanceof Error ? caught.message : "Something went wrong";
}
