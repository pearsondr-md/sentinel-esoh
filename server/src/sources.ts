export type SourceCard = {
  id: string;
  publication: string;
  authorityLayer: string;
  citation: string;
  reviewStatus: "verified" | "unresolved";
  reviewedOn: string;
  statement: string;
  productLimit: string;
};

const REVIEWED_ON = "2026-11-10";

export const SOURCE_CARDS: SourceCard[] = [
  {
    id: "src-atp-5-19-1-45",
    publication: "ATP 5-19",
    authorityLayer: "Doctrine (Army techniques publication)",
    citation: "paragraphs 1-45 through 1-48",
    reviewStatus: "verified",
    reviewedOn: REVIEWED_ON,
    statement:
      "Extremely high is IA, IB, and IIA. High is IC, ID, IIB, IIC, and IIIA. Medium is IE, IID, IIIB, IIIC, and IVA. Low is IIE, IIID, IIIE, IVB, IVC, IVD, and IVE.",
    productLimit: "Look up the cell. Do not calculate a level from an exposure count.",
  },
  {
    id: "src-atp-5-19-1-49",
    publication: "ATP 5-19",
    authorityLayer: "Doctrine (Army techniques publication)",
    citation: "paragraph 1-49",
    reviewStatus: "verified",
    reviewedOn: REVIEWED_ON,
    statement:
      "After controls, practitioners reassess residual risk. The responsible commander accepts or does not accept residual risk.",
    productLimit: "A person records the decision. The model does not accept risk.",
  },
  {
    id: "src-pam-385-30-table-4-1",
    publication: "DA Pam 385-30",
    authorityLayer: "DA pamphlet (procedures)",
    citation: "Table 4-1 and paragraph 4-4f(2)",
    reviewStatus: "verified",
    reviewedOn: REVIEWED_ON,
    statement:
      "Extremely high risk for one month or less is associated with a general officer. Note 3 says high risk beyond one month, or extremely high risk, is always accepted by a general officer or flag officer. High risk for one month or less is associated with a brigade commanding officer or responsible O-6. When the public is exposed to high or extremely high risk, the authority is the Army headquarters commanding general.",
    productLimit: "Check the transcribed cell. A missing cell stays blocked.",
  },
  {
    id: "src-pam-385-30-medium",
    publication: "DA Pam 385-30",
    authorityLayer: "DA pamphlet (procedures)",
    citation: "Table 4-1 medium and low rows",
    reviewStatus: "unresolved",
    reviewedOn: REVIEWED_ON,
    statement:
      "Table 4-1 medium and low rows were misaligned in the text extract. They are not verified and will not be implemented.",
    productLimit: "Do not fill the missing rows.",
  },
  {
    id: "src-ar-385-10-1-9",
    publication: "AR 385-10",
    authorityLayer: "Army regulation",
    citation: "paragraph 1-9",
    reviewStatus: "verified",
    reviewedOn: REVIEWED_ON,
    statement:
      "Six capability objectives: (a) leadership engagement and personnel/Soldier participation (program management); (b) training and promotion; (c) inspections/assessments; (d) mishap, incident, and illness reporting and investigation; (e) hazard analysis and countermeasures; (f) health protection and readiness.",
    productLimit: "Store the labels. Do not produce an official assessment.",
  },
  {
    id: "src-ar-385-10-1-17",
    publication: "AR 385-10",
    authorityLayer: "Army regulation",
    citation: "paragraph 1-17",
    reviewStatus: "verified",
    reviewedOn: REVIEWED_ON,
    statement:
      "The Safety and Occupational Health Advisory Council looks at metric data, including ASOHMS implementation status, mishap summaries, and hazard-abatement status for facility hazards associated with RAC 1, 2, or 3. Minutes are retained at least five years.",
    productLimit: "Count records that are stored. Name the items that are not stored.",
  },
  {
    id: "src-pam-385-10-2-3",
    publication: "DA Pam 385-10",
    authorityLayer: "DA pamphlet (procedures)",
    citation: "paragraph 2-3",
    reviewStatus: "verified",
    reviewedOn: REVIEWED_ON,
    statement: "Supporting actions under the six objectives are procedures. They are not captioned as the 48 criteria.",
    productLimit: "Do not renumber supporting actions as criteria 1 through 48.",
  },
  {
    id: "src-army-dir-2024-09-criteria",
    publication: "Army Directive 2024-09",
    authorityLayer: "Army directive",
    citation: "the directive text reviewed",
    reviewStatus: "unresolved",
    reviewedOn: REVIEWED_ON,
    statement: "The directive text reviewed does not itself list the 48 criteria or the three maturity stages.",
    productLimit: "Do not invent criterion sentences.",
  },
  {
    id: "src-pam-385-40-class",
    publication: "DA Pam 385-40",
    authorityLayer: "DA pamphlet (procedures)",
    citation: "mishap class",
    reviewStatus: "unresolved",
    reviewedOn: REVIEWED_ON,
    statement:
      "Mishap class definitions, cost thresholds, injury thresholds, and notification timelines were not transcribed.",
    productLimit: "Do not assign a mishap class from memory.",
  },
  {
    id: "src-cfr-1904",
    publication: "29 CFR 1904",
    authorityLayer: "federal regulation",
    citation: "the part, as cited by DA Pam 385-10",
    reviewStatus: "unresolved",
    reviewedOn: REVIEWED_ON,
    statement:
      "DA Pam 385-10 cites 29 CFR 1904 for injury recordkeeping. The CFR part was not re-read section by section on 10 November 2026.",
    productLimit: "Do not paste a remembered OSHA rate as a verified rule.",
  },
  {
    id: "src-ar-385-10-7-1",
    publication: "AR 385-10",
    authorityLayer: "Army regulation",
    citation: "paragraph 7-1",
    reviewStatus: "verified",
    reviewedOn: REVIEWED_ON,
    statement:
      "Occupational health includes prevention programs and services, including medical surveillance performed by health professionals.",
    productLimit: "Do not place an individual medical record in a prompt or a table.",
  },
  {
    id: "src-ar-200-1",
    publication: "AR 200-1",
    authorityLayer: "Army regulation",
    citation: "15 April 2026 edition",
    reviewStatus: "unresolved",
    reviewedOn: REVIEWED_ON,
    statement:
      "This review did not read every section of the 15 April 2026 edition. Chapter-level mapping is a scope list, not a complete requirement extract.",
    productLimit: "Do not record a compliance determination.",
  },
];
