export type Session = {
  token: string;
  userId: string;
  displayName: string;
  gradeText: string | null;
  roles: string[];
};

export type WorkFinding = {
  id: string;
  originalText: string;
  status: string;
  inspectionId: string | null;
  authorityResult: string | null;
  actionId: string | null;
  actionStatus: string | null;
  actionDescription: string | null;
  actionOwnerUserId: string | null;
  organizationName: string | null;
  shopName: string | null;
  step: "assess" | "decide" | "assign" | "verify" | "close" | "done";
};

export type OverdueAction = { id: string; findingId: string; description: string; dueOn: string };

export type CampCount = { name: string; steps: Record<string, number>; overdueActions: number };

export type LibraryEntry = { id: string; kind: "chemical" | "job"; name: string; note: string };

export type ChecklistTemplate = { id: string; title: string; shopName: string; items: Array<{ id: string; text: string }> };

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
  sourceReportId: string | null;
  programArea: string | null;
};

export type EmployeeReport = {
  id: string;
  text: string;
  reporterDisplayName: string | null;
  showName: boolean;
};

export type Obligation = {
  id: string;
  title: string;
  applicabilityText: string;
  programArea: string;
};

export type WasteStream = {
  id: string;
  obligationId: string | null;
  name: string;
  wasteKind: string;
};

export type Spill = {
  id: string;
  description: string;
  reportedTo: string;
  materialId?: string | null;
  materialName?: string | null;
  storagePlace?: string | null;
  sheetPlace?: string | null;
};

export type HazardousMaterial = {
  id: string;
  name: string;
  storagePlace: string;
  sheetPlace: string;
};

export type SpillStep = { id: string; step: string; note: string };

export type Mishap = {
  id: string;
  occurredOn: string;
  narrative: string;
  personnelCategory: string;
  outcome: string;
};

export type TrainingSession = {
  id: string;
  topic: string;
  audience: string;
  dueOn: string;
  completedOn: string | null;
  headcount: number;
  basis: string;
};

export type WildlandFire = {
  id: string;
  kind: string;
  place: string;
  occurredOn: string;
  purpose: string;
  note: string;
};

export type AsohmsObjective = {
  code: string;
  regulationLetter: string;
  regulationLabel: string;
  pamphletLabel: string;
  articleLabel: string | null;
  officialText: string | null;
  placeholderNote: string | null;
  practiceStatus: "not started" | "in progress" | "complete";
  stageLabel: string | null;
};

export type SourceCitation = {
  id: string;
  publication: string;
  citation: string;
  reviewStatus: "verified" | "unresolved";
  reviewedOn: string;
  statement: string;
};

export type Answer = {
  id: string;
  question: string;
  notice: string;
  facts: string[];
  observations: string[];
  assumptions: string[];
  recommendations: string[];
  recordCitations: Array<{ id: string; label: string }>;
  sourceCitations: SourceCitation[];
  unverified: Array<{ name: string; reason: string }>;
  structured: boolean;
};

export type CouncilRecord = {
  id: string;
  label: string;
  status?: string;
  step?: string;
  findingId?: string;
  dueOn?: string | null;
  headcount?: number;
};

export type CouncilReport = {
  asOf: string;
  findings: Record<string, number>;
  actions: Record<string, number>;
  inspections: Record<string, number>;
  overdueActions: Array<{ id: string; findingId: string; label: string; dueOn: string | null; status: string }>;
  exposureGroups: { groups: number; people: number };
  obligations: number;
  wasteStreams: number;
  spills: number;
  materials: number;
  mishaps: number;
  training: number;
  wildlandFires: number;
  records: {
    findings: CouncilRecord[];
    actions: CouncilRecord[];
    inspections: CouncilRecord[];
    obligations: CouncilRecord[];
    wasteStreams: CouncilRecord[];
    spills: CouncilRecord[];
    materials: CouncilRecord[];
    mishaps: CouncilRecord[];
    training: CouncilRecord[];
    wildlandFires: CouncilRecord[];
    exposureGroups: CouncilRecord[];
  };
  notStored: Array<{ item: string; reason: string }>;
};

export type ExposureGroup = {
  id: string;
  agent: string;
  shop: string;
  controlMethod: string;
  headcount: number;
  examCompletionPercent: number;
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

export type EvidenceRecord = {
  id: string;
  actionId: string;
  fileName: string;
  contentHash: string;
  uploadedBy: string;
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
  evidence: EvidenceRecord[];
  verifications: Verification[];
  authorizations: Array<{ id: string; taskName: string; note: string; authorizedBy: string; createdAt: string }>;
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
  work: (token: string) =>
    request<{ inspections: Inspection[]; findings: WorkFinding[]; overdue: OverdueAction[] }>("/work", token),
  comparison: (token: string) => request<{ notice: string; camps: CampCount[] }>("/comparison", token),
  organizations: (token: string) => request<{ organizations: Array<{ id: string; name: string }> }>("/organizations", token),
  checklists: (token: string) => request<{ checklists: ChecklistTemplate[] }>("/checklists", token),
  library: (token: string) => request<{ notice: string; entries: LibraryEntry[] }>("/library", token),
  checklistWalk: (
    token: string,
    checklistId: string,
    inspectedOn: string,
    organizationId: string,
    answers: Array<{ itemId: string; passed: boolean }>,
  ) =>
    request<{ inspectionId: string; findings: Array<{ id: string; originalText: string }> }>(
      "/checklist-walks",
      token,
      "POST",
      { checklistId, inspectedOn, organizationId, answers },
    ),
  authorizeWork: (token: string, findingId: string, taskName: string, note: string) =>
    request<{ id: string }>(`/findings/${findingId}/authorizations`, token, "POST", { taskName, note }),
  inspection: (token: string, id: string) =>
    request<{ inspection: Inspection; observations: Observation[]; findings: FindingSummary[] }>(
      `/inspections/${id}`,
      token,
    ),
  users: (token: string) => request<{ users: OrgUser[] }>("/users", token),
  reports: (token: string) => request<{ employeeReports: EmployeeReport[] }>("/employee-reports", token),
  report: (token: string, id: string) =>
    request<{ report: EmployeeReport; findings: FindingSummary[] }>(`/employee-reports/${id}`, token),
  createReport: (token: string, text: string, showName: boolean) =>
    request<EmployeeReport>("/employee-reports", token, "POST", { text, showName }),
  addFindingFromReport: (token: string, reportId: string, originalText: string) =>
    request<FindingSummary>(`/employee-reports/${reportId}/findings`, token, "POST", { originalText }),
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
  addEvidence: (token: string, actionId: string, fileName: string, contentBase64: string) =>
    request<EvidenceRecord>(`/actions/${actionId}/evidence`, token, "POST", { fileName, contentBase64 }),
  verifyAction: (token: string, actionId: string, result: "pass" | "fail", notes: string) =>
    request<Verification>(`/actions/${actionId}/verifications`, token, "POST", { result, notes }),
  closeAction: (token: string, actionId: string) =>
    request<{ finding: FindingSummary }>(`/actions/${actionId}/close`, token, "POST"),
  obligations: (token: string) => request<{ obligations: Obligation[] }>("/obligations", token),
  obligation: (token: string, id: string) =>
    request<{ obligation: Obligation; findings: FindingSummary[] }>(`/obligations/${id}`, token),
  createObligation: (token: string, title: string, applicabilityText: string, programArea: string) =>
    request<Obligation>("/obligations", token, "POST", { title, applicabilityText, programArea }),
  addFindingFromObligation: (token: string, obligationId: string, originalText: string) =>
    request<FindingSummary>(`/obligations/${obligationId}/findings`, token, "POST", { originalText }),
  wasteStreams: (token: string) => request<{ wasteStreams: WasteStream[] }>("/waste-streams", token),
  wasteStream: (token: string, id: string) =>
    request<{ wasteStream: WasteStream; findings: FindingSummary[] }>(`/waste-streams/${id}`, token),
  createWasteStream: (token: string, name: string, wasteKind: string, obligationId: string | null) =>
    request<WasteStream>("/waste-streams", token, "POST", { name, wasteKind, obligationId }),
  addFindingFromWaste: (token: string, wasteStreamId: string, originalText: string) =>
    request<FindingSummary>(`/waste-streams/${wasteStreamId}/findings`, token, "POST", { originalText }),
  spills: (token: string) => request<{ spills: Spill[] }>("/spills", token),
  spill: (token: string, id: string) => request<{ spill: Spill; steps: SpillStep[]; findings: FindingSummary[] }>(`/spills/${id}`, token),
  addSpillStep: (token: string, spillId: string, step: string, note: string) =>
    request<SpillStep>(`/spills/${spillId}/steps`, token, "POST", { step, note }),
  mishaps: (token: string) => request<{ notice: string; mishaps: Mishap[] }>("/mishaps", token),
  mishap: (token: string, id: string) =>
    request<{ notice: string; clock: string | null; mishap: Mishap; findings: FindingSummary[] }>(`/mishaps/${id}`, token),
  createMishap: (token: string, occurredOn: string, narrative: string, personnelCategory: string, outcome: string) =>
    request<{ mishap: Mishap }>("/mishaps", token, "POST", { occurredOn, narrative, personnelCategory, outcome }),
  addFindingFromMishap: (token: string, mishapId: string, originalText: string) =>
    request<FindingSummary>(`/mishaps/${mishapId}/findings`, token, "POST", { originalText }),
  training: (token: string) => request<{ sessions: TrainingSession[] }>("/training", token),
  trainingSession: (token: string, id: string) =>
    request<{ session: TrainingSession; findings: FindingSummary[] }>(`/training/${id}`, token),
  createTraining: (token: string, topic: string, audience: string, dueOn: string, headcount: number, completedOn: string | null) =>
    request<TrainingSession>("/training", token, "POST", { topic, audience, dueOn, headcount, completedOn }),
  addFindingFromTraining: (token: string, trainingId: string, originalText: string) =>
    request<FindingSummary>(`/training/${trainingId}/findings`, token, "POST", { originalText }),
  wildlandFires: (token: string) => request<{ notice: string; fires: WildlandFire[] }>("/wildland-fires", token),
  wildlandFire: (token: string, id: string) =>
    request<{ fire: WildlandFire; findings: FindingSummary[] }>(`/wildland-fires/${id}`, token),
  createWildlandFire: (token: string, kind: string, place: string, occurredOn: string, purpose: string, note: string) =>
    request<WildlandFire>("/wildland-fires", token, "POST", { kind, place, occurredOn, purpose, note }),
  addFindingFromFire: (token: string, fireId: string, originalText: string) =>
    request<FindingSummary>(`/wildland-fires/${fireId}/findings`, token, "POST", { originalText }),
  materials: (token: string) => request<{ notice: string; materials: HazardousMaterial[] }>("/materials", token),
  material: (token: string, id: string) =>
    request<{ material: HazardousMaterial; findings: FindingSummary[] }>(`/materials/${id}`, token),
  createMaterial: (token: string, name: string, storagePlace: string, sheetPlace: string) =>
    request<HazardousMaterial>("/materials", token, "POST", { name, storagePlace, sheetPlace }),
  addFindingFromMaterial: (token: string, materialId: string, originalText: string) =>
    request<FindingSummary>(`/materials/${materialId}/findings`, token, "POST", { originalText }),
  createSpill: (token: string, description: string, reportedTo: string, materialId?: string | null) =>
    request<Spill>("/spills", token, "POST", { description, reportedTo, ...(materialId ? { materialId } : {}) }),
  addFindingFromSpill: (token: string, spillId: string, originalText: string) =>
    request<FindingSummary>(`/spills/${spillId}/findings`, token, "POST", { originalText }),
  council: (token: string) => request<CouncilReport>("/council", token),
  ask: (token: string, question: string, findingId: string | null) =>
    request<Answer>("/questions", token, "POST", { question, ...(findingId ? { findingId } : {}) }),
  asohms: (token: string) => request<{ notice: string; objectives: AsohmsObjective[] }>("/asohms", token),
  saveAsohmsPractice: (
    token: string,
    code: string,
    practiceStatus: AsohmsObjective["practiceStatus"],
    stageLabel: string | null,
  ) =>
    request<{ code: string; practiceStatus: string; stageLabel: string | null }>(
      `/asohms/${code}/practice`,
      token,
      "PUT",
      { practiceStatus, stageLabel },
    ),
  exposureGroups: (token: string) => request<{ exposureGroups: ExposureGroup[] }>("/exposure-groups", token),
  exposureGroup: (token: string, id: string) =>
    request<{ exposureGroup: ExposureGroup }>(`/exposure-groups/${id}`, token),
  createExposureGroup: (
    token: string,
    agent: string,
    shop: string,
    controlMethod: string,
    headcount: number,
    examCompletionPercent: number,
  ) =>
    request<ExposureGroup>("/exposure-groups", token, "POST", {
      agent,
      shop,
      controlMethod,
      headcount,
      examCompletionPercent,
    }),
};
