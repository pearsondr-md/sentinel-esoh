import { useEffect, useState } from "react";
import { api, type AsohmsObjective, type Session } from "./api.ts";

const STATUSES = ["not started", "in progress", "complete"] as const;
const STAGES = ["documentation", "implementation and execution", "sustainment and continuous improvement"] as const;

export function AsohmsView({ session }: { session: Session }) {
  const [notice, setNotice] = useState("");
  const [objectives, setObjectives] = useState<AsohmsObjective[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const page = await api.asohms(session.token);
    setNotice(page.notice);
    setObjectives(page.objectives);
  }

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load ASOHMS notes"));
  }, [session.token]);

  async function save(code: string, practiceStatus: AsohmsObjective["practiceStatus"], stageLabel: string) {
    try {
      await api.saveAsohmsPractice(session.token, code, practiceStatus, stageLabel || null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the practice note");
    }
  }

  if (objectives.length === 0) {
    return <p>{error ?? "Loading the practice notes."}</p>;
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">ASOHMS practice notes</h2>
        <p className="mt-1 text-stone-600">{notice}</p>
      </div>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      {objectives.map((objective) => (
        <article key={objective.code} className="space-y-2 rounded border border-stone-300 bg-white p-4">
          <h3 className="font-semibold">{objective.code}</h3>
          <p className="text-sm">AR 385-10 paragraph 1-9{objective.regulationLetter}: {objective.regulationLabel}</p>
          <p className="text-sm">Mapping note, pamphlet wording: {objective.pamphletLabel}</p>
          {objective.articleLabel ? <p className="text-sm">Public article label: {objective.articleLabel}</p> : null}
          <p className="text-sm">{objective.placeholderNote}</p>
          {session.roles.includes("safety officer") ? (
            <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => event.preventDefault()}>
              <label className="text-sm">
                Practice status
                <select
                  className="mt-1 block rounded border border-stone-400 px-2 py-1"
                  value={objective.practiceStatus}
                  aria-label={`Practice status for ${objective.code}`}
                  onChange={(event) =>
                    void save(objective.code, event.target.value as AsohmsObjective["practiceStatus"], objective.stageLabel ?? "")
                  }
                >
                  {STATUSES.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Stage label
                <select
                  className="mt-1 block rounded border border-stone-400 px-2 py-1"
                  value={objective.stageLabel ?? ""}
                  aria-label={`Stage label for ${objective.code}`}
                  onChange={(event) => void save(objective.code, objective.practiceStatus, event.target.value)}
                >
                  <option value="">No stage label</option>
                  {STAGES.map((stage) => (
                    <option key={stage}>{stage}</option>
                  ))}
                </select>
              </label>
            </form>
          ) : (
            <p className="text-sm">
              Practice status: {objective.practiceStatus}
              {objective.stageLabel ? `. Stage label: ${objective.stageLabel}` : ""}
            </p>
          )}
          <p className="text-xs text-stone-600">
            A stage name is a label on this local note. It is not a maturity rating, and it does not award an Army SOH Star.
          </p>
        </article>
      ))}
    </section>
  );
}
