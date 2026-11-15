export const PROBABILITY_CODES = ["A", "B", "C", "D", "E"] as const;
export const SEVERITY_CODES = ["I", "II", "III", "IV"] as const;
export const MATRIX_LEVELS = ["extremely high", "high", "medium", "low"] as const;
export const ASSESSMENT_PHASES = ["initial", "residual"] as const;
export const DECISIONS = ["accept", "reject"] as const;
export const DURATIONS = ["one month or less", "beyond one month"] as const;
export const FINDING_STATUSES = ["open", "action in progress", "action closed"] as const;
export const ATP_CONTROL_CATEGORIES = ["educational", "physical", "hazard elimination"] as const;
export const HIERARCHY_STEPS = [
  "elimination",
  "substitution",
  "engineering",
  "administrative",
  "PPE",
] as const;

export type ProbabilityCode = (typeof PROBABILITY_CODES)[number];
export type SeverityCode = (typeof SEVERITY_CODES)[number];
export type MatrixLevel = (typeof MATRIX_LEVELS)[number];
export type AssessmentPhase = (typeof ASSESSMENT_PHASES)[number];
export type RiskDecisionValue = (typeof DECISIONS)[number];
export type DurationText = (typeof DURATIONS)[number];
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export type Finding = {
  id: string;
  organizationId: string;
  originalText: string;
  status: FindingStatus;
  sourceObservationId: string | null;
  sourceReportId: string | null;
  programArea: null;
};
