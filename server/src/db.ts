import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { ACCEPTANCE_CELLS, MATRIX_CELLS } from "./doctrine.ts";
import { hashPassword } from "./passwords.ts";
import { ensureLocations } from "./locations.ts";
import { SOURCE_CARDS } from "./sources.ts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS organization (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES organization(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  grade_text TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS role (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS user_role (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  role_id TEXT NOT NULL REFERENCES role(id),
  organization_id TEXT NOT NULL REFERENCES organization(id),
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS session (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inspection (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  shop_name TEXT NOT NULL,
  inspected_on TEXT NOT NULL,
  inspector_user_id TEXT NOT NULL REFERENCES user(id),
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS observation (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  inspection_id TEXT NOT NULL REFERENCES inspection(id),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employee_report (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  text TEXT NOT NULL,
  reporter_display_name TEXT,
  show_name INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS finding (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  original_text TEXT NOT NULL,
  status TEXT NOT NULL,
  source_observation_id TEXT REFERENCES observation(id),
  source_report_id TEXT REFERENCES employee_report(id),
  program_area TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS finding_original_text_immutable
BEFORE UPDATE OF original_text ON finding
BEGIN
  SELECT RAISE(ABORT, 'original_text is immutable');
END;

CREATE TABLE IF NOT EXISTS hazard (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  description TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS finding_hazard (
  finding_id TEXT NOT NULL REFERENCES finding(id),
  hazard_id TEXT NOT NULL REFERENCES hazard(id),
  PRIMARY KEY (finding_id, hazard_id)
);

CREATE TABLE IF NOT EXISTS risk_matrix_cell (
  probability_code TEXT NOT NULL,
  severity_code TEXT NOT NULL,
  matrix_cell TEXT NOT NULL,
  matrix_level TEXT NOT NULL,
  doctrine_ref TEXT NOT NULL,
  PRIMARY KEY (probability_code, severity_code)
);

CREATE TABLE IF NOT EXISTS risk_acceptance_cell (
  matrix_level TEXT NOT NULL,
  duration_text TEXT NOT NULL,
  public_exposed INTEGER NOT NULL,
  grade_text TEXT NOT NULL,
  basis TEXT NOT NULL,
  PRIMARY KEY (matrix_level, duration_text, public_exposed, grade_text)
);

CREATE TABLE IF NOT EXISTS risk_assessment (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  hazard_id TEXT NOT NULL REFERENCES hazard(id),
  phase TEXT NOT NULL,
  probability_code TEXT NOT NULL,
  severity_code TEXT NOT NULL,
  matrix_level TEXT NOT NULL,
  matrix_cell TEXT NOT NULL,
  doctrine_ref TEXT NOT NULL,
  estimated_by TEXT NOT NULL REFERENCES user(id),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS control (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  assessment_id TEXT NOT NULL REFERENCES risk_assessment(id),
  atp_category TEXT NOT NULL,
  hierarchy_step TEXT,
  what_text TEXT NOT NULL,
  who_text TEXT NOT NULL,
  how_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS risk_decision (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  assessment_id TEXT NOT NULL REFERENCES risk_assessment(id),
  decision TEXT NOT NULL,
  decided_by TEXT NOT NULL REFERENCES user(id),
  grade_text TEXT,
  duration_text TEXT NOT NULL,
  public_exposed INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS authority_check (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  decision_id TEXT NOT NULL REFERENCES risk_decision(id),
  result TEXT NOT NULL,
  basis TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS corrective_action (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  finding_id TEXT NOT NULL REFERENCES finding(id),
  hazard_id TEXT NOT NULL REFERENCES hazard(id),
  description TEXT NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES user(id),
  due_on TEXT,
  status TEXT NOT NULL,
  kind TEXT NOT NULL,
  completed_by TEXT REFERENCES user(id),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  action_id TEXT NOT NULL REFERENCES corrective_action(id),
  file_name TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES user(id),
  uploaded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  action_id TEXT NOT NULL REFERENCES corrective_action(id),
  result TEXT NOT NULL,
  notes TEXT,
  verifier_user_id TEXT NOT NULL REFERENCES user(id),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS obligation (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  title TEXT NOT NULL,
  applicability_text TEXT NOT NULL,
  program_area TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS obligation_finding (
  obligation_id TEXT NOT NULL REFERENCES obligation(id),
  finding_id TEXT NOT NULL REFERENCES finding(id),
  PRIMARY KEY (obligation_id, finding_id)
);

CREATE TABLE IF NOT EXISTS waste_stream (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  obligation_id TEXT REFERENCES obligation(id),
  name TEXT NOT NULL,
  waste_kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS waste_stream_finding (
  waste_stream_id TEXT NOT NULL REFERENCES waste_stream(id),
  finding_id TEXT NOT NULL REFERENCES finding(id),
  PRIMARY KEY (waste_stream_id, finding_id)
);

CREATE TABLE IF NOT EXISTS spill (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  description TEXT NOT NULL,
  reported_to TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS spill_finding (
  spill_id TEXT NOT NULL REFERENCES spill(id),
  finding_id TEXT NOT NULL REFERENCES finding(id),
  PRIMARY KEY (spill_id, finding_id)
);

CREATE TABLE IF NOT EXISTS exposure_group (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  agent TEXT NOT NULL,
  shop TEXT NOT NULL,
  control_method TEXT NOT NULL,
  headcount INTEGER NOT NULL,
  exam_completion_percent REAL NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS asohms_objective (
  id TEXT PRIMARY KEY,
  regulation_letter TEXT NOT NULL,
  regulation_label TEXT NOT NULL,
  pamphlet_label TEXT NOT NULL,
  article_label TEXT,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS asohms_criterion (
  id TEXT PRIMARY KEY,
  objective_id TEXT NOT NULL REFERENCES asohms_objective(id),
  official_text TEXT,
  placeholder_note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS asohms_score (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  objective_id TEXT NOT NULL REFERENCES asohms_objective(id),
  practice_status TEXT NOT NULL,
  stage_label TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  UNIQUE (organization_id, objective_id)
);

CREATE TABLE IF NOT EXISTS source_document (
  id TEXT PRIMARY KEY,
  publication TEXT NOT NULL,
  authority_layer TEXT NOT NULL,
  citation TEXT NOT NULL,
  review_status TEXT NOT NULL,
  reviewed_on TEXT NOT NULL,
  statement TEXT NOT NULL,
  product_limit TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_exchange (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  user_id TEXT NOT NULL,
  question TEXT NOT NULL,
  finding_id TEXT,
  record_ids TEXT NOT NULL,
  source_ids TEXT NOT NULL,
  reply_text TEXT NOT NULL,
  reply_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS record_event (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reason TEXT
);
`;

export const DEMO_PASSWORD = "camp-sentinel-demo";

export function defaultDbPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "data", "sentinel.db");
}

export function openDatabase(dbPath: string): DatabaseSync {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  seed(db);
  ensureShopEmployee(db);
  ensureAsohms(db);
  ensureSources(db);
  ensureLocations(db, hashPassword(DEMO_PASSWORD));
  return db;
}

function seed(db: DatabaseSync): void {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM organization").get() as { n: number };
  if (existing.n > 0) {
    return;
  }
  const now = new Date().toISOString();
  const insertOrg = db.prepare(
    "INSERT INTO organization (id, parent_id, name, created_at, created_by) VALUES (?, ?, ?, ?, NULL)",
  );
  insertOrg.run("org-camp", null, "Camp Sentinel", now);
  insertOrg.run("org-unit-1", "org-camp", "1st Tenant Unit", now);
  insertOrg.run("org-shop-2", "org-unit-1", "Shop 2", now);
  insertOrg.run("org-unit-2", "org-camp", "2nd Tenant Unit", now);

  const roles = ["employee", "supervisor", "safety officer", "commander", "administrator"];
  const insertRole = db.prepare("INSERT INTO role (id, name) VALUES (?, ?)");
  for (const name of roles) {
    insertRole.run(name, name);
  }

  const passwordHash = hashPassword(DEMO_PASSWORD);
  const insertUser = db.prepare(
    `INSERT INTO user (id, organization_id, email, password_hash, display_name, grade_text, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
  );
  insertUser.run(
    "user-shop2-safety",
    "org-shop-2",
    "shop2.safety@camp-sentinel.example",
    passwordHash,
    "Shop 2 Safety Officer",
    null,
    now,
  );
  insertUser.run(
    "user-shop2-commander",
    "org-shop-2",
    "shop2.commander@camp-sentinel.example",
    passwordHash,
    "Shop 2 Commander",
    "O-5",
    now,
  );
  insertUser.run(
    "user-shop2-supervisor",
    "org-shop-2",
    "shop2.supervisor@camp-sentinel.example",
    passwordHash,
    "Shop 2 Supervisor",
    null,
    now,
  );
  insertUser.run(
    "user-unit2-safety",
    "org-unit-2",
    "unit2.safety@camp-sentinel.example",
    passwordHash,
    "2nd Tenant Unit Safety Officer",
    null,
    now,
  );

  const insertUserRole = db.prepare(
    "INSERT INTO user_role (id, user_id, role_id, organization_id, created_at, created_by) VALUES (?, ?, ?, ?, ?, NULL)",
  );
  insertUserRole.run("ur-1", "user-shop2-safety", "safety officer", "org-shop-2", now);
  insertUserRole.run("ur-2", "user-shop2-commander", "commander", "org-shop-2", now);
  insertUserRole.run("ur-3", "user-shop2-supervisor", "supervisor", "org-shop-2", now);
  insertUserRole.run("ur-4", "user-unit2-safety", "safety officer", "org-unit-2", now);
  insertShopEmployee(db, now, passwordHash);

  const insertCell = db.prepare(
    `INSERT INTO risk_matrix_cell (probability_code, severity_code, matrix_cell, matrix_level, doctrine_ref)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const cell of MATRIX_CELLS) {
    insertCell.run(
      cell.probabilityCode,
      cell.severityCode,
      cell.matrixCell,
      cell.matrixLevel,
      cell.doctrineRef,
    );
  }

  const insertAuthority = db.prepare(
    `INSERT INTO risk_acceptance_cell (matrix_level, duration_text, public_exposed, grade_text, basis)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const cell of ACCEPTANCE_CELLS) {
    insertAuthority.run(
      cell.matrixLevel,
      cell.durationText,
      cell.publicExposed ? 1 : 0,
      cell.gradeText,
      cell.basis,
    );
  }
}

function ensureShopEmployee(db: DatabaseSync): void {
  const existing = db.prepare("SELECT id FROM user WHERE email = ?").get("shop2.employee@camp-sentinel.example");
  if (existing) {
    return;
  }
  insertShopEmployee(db, new Date().toISOString(), hashPassword(DEMO_PASSWORD));
}

function insertShopEmployee(db: DatabaseSync, now: string, passwordHash: string): void {
  db.prepare(
    `INSERT INTO user (id, organization_id, email, password_hash, display_name, grade_text, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
  ).run(
    "user-shop2-employee",
    "org-shop-2",
    "shop2.employee@camp-sentinel.example",
    passwordHash,
    "Shop 2 Employee",
    null,
    now,
  );
  db.prepare(
    "INSERT INTO user_role (id, user_id, role_id, organization_id, created_at, created_by) VALUES (?, ?, ?, ?, ?, NULL)",
  ).run("ur-employee", "user-shop2-employee", "employee", "org-shop-2", now);
}

const ASOHMS_OBJECTIVES: Array<[string, string, string, string, string | null, number]> = [
  ["CO-LEAD", "a", "Leadership engagement and personnel/Soldier participation (program management)", "Leadership engagement and employee/Soldier participation", "Leadership Engagement and Personnel/Soldier Readiness", 1],
  ["CO-MISHAP", "d", "Mishap, incident, and illness reporting and investigation", "Investigate and report mishaps, incidents, and illnesses", null, 2],
  ["CO-TRAIN", "b", "Training and promotion", "Conduct safety and occupational health training and promotion", null, 3],
  ["CO-INSPECT", "c", "Inspections/assessments", "Conduct inspections and assessments", null, 4],
  ["CO-HAZARD", "e", "Hazard analysis and countermeasures", "Conduct hazard analysis and develop countermeasures", null, 5],
  ["CO-HEALTH", "f", "Health protection and readiness", "Health protection and readiness", null, 6],
];

function ensureSources(db: DatabaseSync): void {
  const insert = db.prepare(
    `INSERT INTO source_document (
       id, publication, authority_layer, citation, review_status, reviewed_on, statement, product_limit
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
  );
  for (const card of SOURCE_CARDS) {
    insert.run(
      card.id,
      card.publication,
      card.authorityLayer,
      card.citation,
      card.reviewStatus,
      card.reviewedOn,
      card.statement,
      card.productLimit,
    );
  }
}

function ensureAsohms(db: DatabaseSync): void {
  const insertObjective = db.prepare(
    `INSERT INTO asohms_objective (id, regulation_letter, regulation_label, pamphlet_label, article_label, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
  );
  const insertCriterion = db.prepare(
    `INSERT INTO asohms_criterion (id, objective_id, official_text, placeholder_note)
     VALUES (?, ?, NULL, ?)
     ON CONFLICT(id) DO NOTHING`,
  );
  for (const objective of ASOHMS_OBJECTIVES) {
    insertObjective.run(...objective);
    insertCriterion.run(
      `placeholder-${objective[0]}`,
      objective[0],
      "Official criterion text is not loaded. This row is a placeholder.",
    );
  }
}
