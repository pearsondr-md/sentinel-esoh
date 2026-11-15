export type Session = {
  token: string;
  userId: string;
  displayName: string;
  gradeText: string | null;
  roles: string[];
};

export type Inspection = {
  id: string;
  shopName: string;
  inspectedOn: string;
  status: string;
};

export type Observation = { id: string; text: string };
export type FindingSummary = {
  id: string;
  originalText: string;
  status: string;
  sourceObservationId: string | null;
};

export type Assessment = {
  id: string;
  phase: string;
  probabilityCode: string;
  severityCode: string;
  matrixLevel: string;
  matrixCell: string;
  doctrineRef: string;
};

export type Control = {
  id: string;
  whatText: string;
  whoText: string;
  howText: string;
  atpCategory: string;
};

export type Decision = {
  id: string;
  decision: string;
  gradeText: string | null;
  durationText: string;
  publicExposed: boolean;
};

export type AuthorityCheck = {
  id: string;
  decisionId: string;
  result: string;
  basis: string;
};

export type ActionRecord = {
  id: string;
  description: string;
  ownerUserId: string;
  status: string;
  completedBy: string | null;
};

export type Verification = {
  id: string;
  result: string;
  notes: string | null;
  verifierUserId: string;
};

export type FindingChain = {
  finding: FindingSummary;
  hazards: Array<{ id: string; description: string }>;
  assessments: Assessment[];
  controls: Control[];
  decisions: Decision[];
  authorityChecks: AuthorityCheck[];
  actions: ActionRecord[];
  verifications: Verification[];
};

export type OrgUser = {
  id: string;
  displayName: string;
  gradeText: string | null;
  roles: string[];
};

async function request<T>(path: string, token: string | null, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "The request failed");
  }
  return payload;
}

export const api = {
  signIn: (email: string, password: string) =>
    request<Session>("/session", null, "POST", { email, password }),
  inspections: (token: string) => request<{ inspections: Inspection[] }>("/inspections", token),
  inspection: (token: string, id: string) =>
    request<{ inspection: Inspection; observations: Observation[]; findings: FindingSummary[] }>(
      `/inspections/${id}`,
      token,
    ),
  users: (token: string) => request<{ users: OrgUser[] }>("/users", token),
  finding: (token: string, id: string) => request<FindingChain>(`/findings/${id}`, token),
  createInspection: (token: string, shopName: string, inspectedOn: string) =>
    request<Inspection>("/inspections", token, "POST", { shopName, inspectedOn }),
  addObservation: (token: string, inspectionId: string, text: string) =>
    request<Observation>(`/inspections/${inspectionId}/observations`, token, "POST", { text }),
  addFinding: (token: string, observationId: string, originalText: string) =>
    request<FindingSummary>(`/observations/${observationId}/findings`, token, "POST", { originalText }),
  addHazard: (token: string, findingId: string, description: string) =>
    request<{ id: string }>(`/findings/${findingId}/hazards`, token, "POST", { description }),
  addAssessment: (
    token: string,
    hazardId: string,
    phase: "initial" | "residual",
    probabilityCode: string,
    severityCode: string,
  ) =>
    request<Assessment>(`/hazards/${hazardId}/assessments`, token, "POST", {
      phase,
      probabilityCode,
      severityCode,
    }),
  addControl: (token: string, assessmentId: string, whatText: string, whoText: string, howText: string) =>
    request<Control>(`/assessments/${assessmentId}/controls`, token, "POST", {
      atpCategory: "physical",
      whatText,
      whoText,
      howText,
    }),
  addDecision: (
    token: string,
    assessmentId: string,
    decision: "accept" | "reject",
    durationText: string,
    publicExposed: boolean,
  ) =>
    request<{ decision: Decision; authorityCheck: AuthorityCheck; matrixLevel: string; matrixCell: string }>(
      `/assessments/${assessmentId}/decisions`,
      token,
      "POST",
      { decision, durationText, publicExposed },
    ),
  addAction: (token: string, findingId: string, hazardId: string, description: string, ownerUserId: string) =>
    request<ActionRecord>(`/findings/${findingId}/actions`, token, "POST", {
      hazardId,
      description,
      ownerUserId,
      kind: "corrective",
    }),
  completeAction: (token: string, actionId: string) =>
    request<ActionRecord>(`/actions/${actionId}/complete`, token, "POST"),
  verifyAction: (token: string, actionId: string, result: "pass" | "fail", notes: string) =>
    request<Verification>(`/actions/${actionId}/verifications`, token, "POST", { result, notes }),
  closeAction: (token: string, actionId: string) =>
    request<{ finding: FindingSummary }>(`/actions/${actionId}/close`, token, "POST"),
};
