import type { DurationText, MatrixLevel, ProbabilityCode, SeverityCode } from "../../shared/src/index.ts";

export type MatrixCell = {
  probabilityCode: ProbabilityCode;
  severityCode: SeverityCode;
  matrixCell: string;
  matrixLevel: MatrixLevel;
  doctrineRef: string;
};

export type AcceptanceCell = {
  id: string;
  matrixLevel: MatrixLevel;
  durationText: DurationText;
  publicExposed: boolean;
  gradeText: string;
  basis: string;
};

const EXTREMELY_HIGH = "ATP 5-19 paragraph 1-45";
const HIGH = "ATP 5-19 paragraph 1-46";
const MEDIUM = "ATP 5-19 paragraph 1-47";
const LOW = "ATP 5-19 paragraph 1-48";

function cells(
  pairs: Array<[SeverityCode, ProbabilityCode]>,
  matrixLevel: MatrixLevel,
  doctrineRef: string,
): MatrixCell[] {
  return pairs.map(([severityCode, probabilityCode]) => ({
    probabilityCode,
    severityCode,
    matrixCell: `${severityCode}${probabilityCode}`,
    matrixLevel,
    doctrineRef,
  }));
}

// ATP 5-19 paragraphs 1-45 through 1-48, in the cell lists from the source register.
// Probability words are paragraphs 1-33 through 1-38. The exposure examples in
// paragraphs 1-34 and 1-35 are not a formula and are not inputs here.
export const MATRIX_CELLS: MatrixCell[] = [
  ...cells(
    [
      ["I", "A"],
      ["I", "B"],
      ["II", "A"],
    ],
    "extremely high",
    EXTREMELY_HIGH,
  ),
  ...cells(
    [
      ["I", "C"],
      ["I", "D"],
      ["II", "B"],
      ["II", "C"],
      ["III", "A"],
    ],
    "high",
    HIGH,
  ),
  ...cells(
    [
      ["I", "E"],
      ["II", "D"],
      ["III", "B"],
      ["III", "C"],
      ["IV", "A"],
    ],
    "medium",
    MEDIUM,
  ),
  ...cells(
    [
      ["II", "E"],
      ["III", "D"],
      ["III", "E"],
      ["IV", "B"],
      ["IV", "C"],
      ["IV", "D"],
      ["IV", "E"],
    ],
    "low",
    LOW,
  ),
];

// DA Pam 385-30, as read in the source register. Medium and low rows are absent.
// An absent row is not permission for anyone to accept.
const NOTE_3 = "table-4-1-note-3";
const HIGH_MONTH = "table-4-1-high-one-month-or-less";
const PUBLIC_HIGH = "paragraph-4-4f-2";

function acceptanceRows(
  matrixLevel: MatrixLevel,
  durations: DurationText[],
  grades: string[],
  basis: string,
  publicExposed: boolean,
): AcceptanceCell[] {
  const rows: AcceptanceCell[] = [];
  for (const durationText of durations) {
    for (const gradeText of grades) {
      rows.push({
        id: basis,
        matrixLevel,
        durationText,
        publicExposed,
        gradeText,
        basis,
      });
    }
  }
  return rows;
}

export const ACCEPTANCE_CELLS: AcceptanceCell[] = [
  ...acceptanceRows(
    "extremely high",
    ["one month or less", "beyond one month"],
    ["general officer", "flag officer"],
    NOTE_3,
    false,
  ),
  ...acceptanceRows(
    "high",
    ["beyond one month"],
    ["general officer", "flag officer"],
    NOTE_3,
    false,
  ),
  ...acceptanceRows(
    "high",
    ["one month or less"],
    ["brigade commanding officer", "O-6"],
    HIGH_MONTH,
    false,
  ),
  ...acceptanceRows(
    "extremely high",
    ["one month or less", "beyond one month"],
    ["Army headquarters commanding general"],
    PUBLIC_HIGH,
    true,
  ),
  ...acceptanceRows(
    "high",
    ["one month or less", "beyond one month"],
    ["Army headquarters commanding general"],
    PUBLIC_HIGH,
    true,
  ),
];

export function lookupMatrix(
  cells: MatrixCell[],
  probabilityCode: string,
  severityCode: string,
): MatrixCell {
  const cell = cells.find(
    (row) => row.probabilityCode === probabilityCode && row.severityCode === severityCode,
  );
  if (!cell) {
    throw new Error("probability and severity do not match a matrix cell");
  }
  return cell;
}

export function lookupAcceptance(
  cells: AcceptanceCell[],
  input: {
    matrixLevel: MatrixLevel;
    durationText: DurationText;
    publicExposed: boolean;
    gradeText: string | null;
  },
): { result: "allowed" | "blocked"; basis: string } {
  const applicable = cells.filter(
    (row) =>
      row.matrixLevel === input.matrixLevel &&
      row.durationText === input.durationText &&
      row.publicExposed === input.publicExposed,
  );
  if (applicable.length === 0) {
    return { result: "blocked", basis: "authority cell not verified" };
  }
  const match = applicable.find((row) => row.gradeText === input.gradeText);
  if (!match) {
    return { result: "blocked", basis: applicable[0].basis };
  }
  return { result: "allowed", basis: match.basis };
}
