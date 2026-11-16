import type { SourceCard } from "./sources.ts";

export type SuppliedRecord = { id: string; label: string };

export type CheckedReply = {
  facts: string[];
  observations: string[];
  assumptions: string[];
  recommendations: string[];
  recordCitations: SuppliedRecord[];
  sourceCitations: SourceCard[];
  unverified: Array<{ name: string; reason: string }>;
  structured: boolean;
};

const PUBLICATION =
  /\b(?:Army Directive\s+\d{4}-\d+|AR\s+\d+-\d+|DA Pam\s+\d+-\d+|ATP\s+\d+-\d+|DoDI\s+\d+\.\d+|DoDM\s+\d+\.\d+|DoDD\s+\d+\.\d+[A-Z]?|29 CFR\s+\d+|40 CFR\s+\d+|Public Law\s+\d+-\d+)\b/g;

export function buildQuestionPrompt(input: {
  question: string;
  records: unknown;
  recordIds: string[];
  sources: SourceCard[];
  earlier?: Array<{ question: string; answer: string }>;
}): string {
  const turns = (input.earlier ?? []).flatMap((turn) => ["Earlier question:", turn.question, "Earlier answer:", turn.answer, ""]);
  return [
    ...turns,
    "Question:",
    input.question,
    "",
    "Record ids you may cite:",
    JSON.stringify(input.recordIds),
    "",
    "Records:",
    JSON.stringify(input.records),
    "",
    "Source cards you may cite:",
    JSON.stringify(input.sources),
  ].join("\n");
}

export const MODEL_INSTRUCTIONS = [
  "You explain records that were supplied to you.",
  "Questions about what is assigned or overdue are answered from work.assignedToYou and work.overdue. work.today is the date. waiting lists findings by step.",
  "Do not invent a row that was not supplied. If the list is empty, say so in facts.",
  "Write each fact as a plain sentence naming the work and the date. When asked who owns the work, name the owner. Do not print ids, field names, or JSON.",
  "Separate facts, observations, assumptions, and recommendations.",
  "Say when the records are too few to support a conclusion.",
  "Cite a record id only if it was supplied. Cite a source id only if its card was supplied.",
  "Put any other publication name in otherPublications.",
  "State conflicts and uncertainty, including unresolved source cards.",
  "Decline to set a risk level, accept risk, assign an action, or close a record.",
  "Return JSON only, with keys facts, observations, assumptions, recommendations, recordCitations, sourceCitations, and otherPublications.",
  "The citation keys are arrays of id strings.",
].join(" ");

export function checkReply(raw: string, records: SuppliedRecord[], sources: SourceCard[]): CheckedReply {
  const recordById = new Map(records.map((record) => [record.id, record]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const suppliedPublications = new Set(sources.map((source) => normalize(source.publication)));
  const parsed = parseModelJson(raw);
  const unverified: Array<{ name: string; reason: string }> = [];
  const seen = new Set<string>();

  function addUnverified(name: string, reason: string): void {
    const key = `${normalize(name)}|${reason}`;
    if (seen.has(key) || name.trim() === "") return;
    seen.add(key);
    unverified.push({ name: name.trim(), reason });
  }

  const recordCitations: SuppliedRecord[] = [];
  for (const id of parsed.recordCitations) {
    const record = recordById.get(id);
    if (record) {
      if (!recordCitations.some((item) => item.id === record.id)) recordCitations.push(record);
    } else {
      addUnverified(id, "This record was not supplied.");
    }
  }

  const sourceCitations: SourceCard[] = [];
  for (const id of parsed.sourceCitations) {
    const source = sourceById.get(id);
    if (source) {
      if (!sourceCitations.some((item) => item.id === source.id)) sourceCitations.push(source);
    } else {
      addUnverified(id, "This source card was not supplied.");
    }
  }

  const prose = [
    ...parsed.facts,
    ...parsed.observations,
    ...parsed.assumptions,
    ...parsed.recommendations,
    ...parsed.otherPublications,
    ...(parsed.structured ? [] : [raw]),
  ].join("\n");
  for (const match of prose.match(PUBLICATION) ?? []) {
    if (!suppliedPublications.has(normalize(match))) {
      addUnverified(match, "This publication was not supplied.");
    }
  }
  for (const name of parsed.otherPublications) {
    if (!suppliedPublications.has(normalize(name)) && !(prose.match(PUBLICATION) ?? []).some((match) => normalize(match) === normalize(name))) {
      addUnverified(name, "This publication was not supplied.");
    }
  }

  return {
    facts: parsed.facts,
    observations: parsed.observations,
    assumptions: parsed.assumptions,
    recommendations: parsed.recommendations,
    recordCitations,
    sourceCitations,
    unverified,
    structured: parsed.structured,
  };
}

export async function callXai(prompt: string): Promise<string> {
  const key = process.env.XAI_API_KEY;
  if (!key) {
    throw new Error("The xAI key is not set on the server.");
  }
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.XAI_MODEL ?? "grok-4",
      temperature: 0,
      messages: [
        { role: "system", content: MODEL_INSTRUCTIONS },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`The model call failed (${response.status}).`);
  }
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("The model call failed.");
  }
  return content;
}

function parseModelJson(raw: string): {
  facts: string[];
  observations: string[];
  assumptions: string[];
  recommendations: string[];
  recordCitations: string[];
  sourceCitations: string[];
  otherPublications: string[];
  structured: boolean;
} {
  const empty = {
    facts: [],
    observations: [],
    assumptions: [],
    recommendations: [],
    recordCitations: [],
    sourceCitations: [],
    otherPublications: [],
    structured: false,
  };
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const value = JSON.parse(trimmed) as Record<string, unknown>;
    if (!value || typeof value !== "object" || Array.isArray(value)) return empty;
    return {
      facts: strings(value.facts).length > 0 ? strings(value.facts) : strings(value.key_facts),
      observations: strings(value.observations),
      assumptions: strings(value.assumptions),
      recommendations: strings(value.recommendations),
      recordCitations: strings(value.recordCitations),
      sourceCitations: strings(value.sourceCitations),
      otherPublications: strings(value.otherPublications),
      structured: true,
    };
  } catch {
    return empty;
  }
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "").map((item) => item.trim());
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
