import { randomBytes, randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import {
  ATP_CONTROL_CATEGORIES,
  DECISIONS,
  DURATIONS,
  HIERARCHY_STEPS,
  type DurationText,
  type FindingStatus,
  type MatrixLevel,
} from "../../shared/src/index.ts";
import { openDatabase } from "./db.ts";
import {
  lookupAcceptance,
  lookupMatrix,
  type AcceptanceCell,
  type MatrixCell,
} from "./doctrine.ts";
import { verifyPassword } from "./passwords.ts";

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Actor = {
  id: string;
  displayName: string;
  gradeText: string | null;
  roles: string[];
  organizationIds: string[];
};

type FindingRow = {
  id: string;
  organization_id: string;
  original_text: string;
  status: FindingStatus;
  source_observation_id: string | null;
  source_report_id: string | null;
  program_area: string | null;
};

export function createApp(dbPath: string): { app: express.Express; db: DatabaseSync } {
  const db = openDatabase(dbPath);
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/session", wrap((req, res) => {
    const body = bodyOf(req);
    const email = requireString(body, "email");
    const password = requireString(body, "password");
    const user = db
      .prepare("SELECT id, password_hash, display_name, grade_text FROM user WHERE email = ?")
      .get(email) as
      | { id: string; password_hash: string; display_name: string; grade_text: string | null }
      | undefined;
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new HttpError(401, "email or password is wrong");
    }
    const token = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO session (token, user_id, created_at) VALUES (?, ?, ?)").run(
      token,
      user.id,
      now(),
    );
    res.status(201).json({ token, displayName: user.display_name, gradeText: user.grade_text });
  }));

  app.get("/inspections", wrap((req, res) => {
    const actor = requireActor(db, req);
    res.json({ inspections: listScoped(db, actor, "inspection", "inspected_on DESC") });
  }));

  app.post("/inspections", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const body = bodyOf(req);
    rejectProgramArea(body);
    const shopName = requireString(body, "shopName");
    const inspectedOn = requireString(body, "inspectedOn");
    const id = randomUUID();
    const organizationId = homeOrg(actor);
    db.prepare(
      `INSERT INTO inspection (id, organization_id, shop_name, inspected_on, inspector_user_id, status, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`,
    ).run(id, organizationId, shopName, inspectedOn, actor.id, now(), actor.id);
    recordEvent(db, organizationId, "inspection", id, null, "draft", actor.id, null);
    res.status(201).json(getOne(db, "inspection", id));
  }));

  app.post("/inspections/:id/complete", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const inspection = mustGet(db, "inspection", routeId(req.params.id), actor);
    if (inspection.status !== "draft") {
      throw new HttpError(409, "inspection is already complete");
    }
    db.prepare("UPDATE inspection SET status = 'complete' WHERE id = ?").run(inspection.id);
    recordEvent(db, inspection.organization_id, "inspection", inspection.id, "draft", "complete", actor.id, null);
    res.json(getOne(db, "inspection", inspection.id));
  }));

  app.post("/inspections/:id/observations", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const inspection = mustGet(db, "inspection", routeId(req.params.id), actor);
    const text = requireString(bodyOf(req), "text");
    const id = randomUUID();
    db.prepare(
      `INSERT INTO observation (id, organization_id, inspection_id, text, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, inspection.organization_id, inspection.id, text, now(), actor.id);
    res.status(201).json(getOne(db, "observation", id));
  }));

  app.post("/employee-reports", wrap((req, res) => {
    const actor = requireActor(db, req);
    const body = bodyOf(req);
    const text = requireString(body, "text");
    const showName = body.showName === true;
    const reporterDisplayName = showName ? optionalString(body, "reporterDisplayName") : null;
    const id = randomUUID();
    const organizationId = homeOrg(actor);
    db.prepare(
      `INSERT INTO employee_report (id, organization_id, text, reporter_display_name, show_name, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, organizationId, text, reporterDisplayName, showName ? 1 : 0, now(), actor.id);
    res.status(201).json(publicReport(getOne(db, "employee_report", id)));
  }));

  app.get("/employee-reports", wrap((req, res) => {
    const actor = requireActor(db, req);
    const rows = listScoped(db, actor, "employee_report", "created_at DESC");
    res.json({ employeeReports: rows.map(publicReport) });
  }));

  app.post("/observations/:id/findings", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const observation = mustGet(db, "observation", routeId(req.params.id), actor);
    const finding = insertFinding(db, actor, {
      organizationId: observation.organization_id,
      originalText: requireOriginalText(bodyOf(req)),
      sourceObservationId: observation.id,
      sourceReportId: null,
    });
    res.status(201).json(publicFinding(finding));
  }));

  app.post("/employee-reports/:id/findings", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const report = mustGet(db, "employee_report", routeId(req.params.id), actor);
    const finding = insertFinding(db, actor, {
      organizationId: report.organization_id,
      originalText: requireOriginalText(bodyOf(req)),
      sourceObservationId: null,
      sourceReportId: report.id,
    });
    res.status(201).json(publicFinding(finding));
  }));

  app.get("/findings/:id", wrap((req, res) => {
    const actor = requireActor(db, req);
    const finding = mustFinding(db, routeId(req.params.id), actor);
    res.json(findingChain(db, finding));
  }));

  app.post("/findings/:id/hazards", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const finding = mustFinding(db, routeId(req.params.id), actor);
    const description = requireString(bodyOf(req), "description");
    const id = randomUUID();
    db.prepare(
      `INSERT INTO hazard (id, organization_id, description, created_at, created_by) VALUES (?, ?, ?, ?, ?)`,
    ).run(id, finding.organization_id, description, now(), actor.id);
    db.prepare("INSERT INTO finding_hazard (finding_id, hazard_id) VALUES (?, ?)").run(finding.id, id);
    res.status(201).json(getOne(db, "hazard", id));
  }));

  app.post("/hazards/:id/assessments", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const hazard = mustGet(db, "hazard", routeId(req.params.id), actor);
    const body = bodyOf(req);
    rejectOverride(body);
    const phase = requireEnum(body, "phase", ["initial", "residual"]);
    const probabilityCode = requireString(body, "probabilityCode");
    const severityCode = requireString(body, "severityCode");
    const cell = lookupMatrix(loadMatrix(db), probabilityCode, severityCode);
    const id = randomUUID();
    db.prepare(
      `INSERT INTO risk_assessment (
         id, organization_id, hazard_id, phase, probability_code, severity_code,
         matrix_level, matrix_cell, doctrine_ref, estimated_by, created_at, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      hazard.organization_id,
      hazard.id,
      phase,
      cell.probabilityCode,
      cell.severityCode,
      cell.matrixLevel,
      cell.matrixCell,
      cell.doctrineRef,
      actor.id,
      now(),
      actor.id,
    );
    res.status(201).json(publicAssessment(getOne(db, "risk_assessment", id)));
  }));

  app.post("/assessments/:id/controls", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const assessment = mustGet(db, "risk_assessment", routeId(req.params.id), actor);
    if (assessment.phase !== "residual") {
      throw new HttpError(409, "controls belong to the residual assessment");
    }
    const body = bodyOf(req);
    const id = randomUUID();
    db.prepare(
      `INSERT INTO control (
         id, organization_id, assessment_id, atp_category, hierarchy_step, what_text, who_text, how_text, created_at, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      assessment.organization_id,
      assessment.id,
      requireEnum(body, "atpCategory", [...ATP_CONTROL_CATEGORIES]),
      optionalEnum(body, "hierarchyStep", [...HIERARCHY_STEPS]),
      requireString(body, "whatText"),
      requireString(body, "whoText"),
      requireString(body, "howText"),
      now(),
      actor.id,
    );
    res.status(201).json(getOne(db, "control", id));
  }));

  app.post("/assessments/:id/decisions", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "commander");
    const assessment = mustGet(db, "risk_assessment", routeId(req.params.id), actor);
    if (assessment.phase !== "residual") {
      throw new HttpError(409, "the decision refers to the residual assessment");
    }
    const body = bodyOf(req);
    rejectOverride(body);
    const decision = requireEnum(body, "decision", [...DECISIONS]);
    const durationText = requireEnum(body, "durationText", [...DURATIONS]) as DurationText;
    const publicExposed = requireBoolean(body, "publicExposed");
    const authority = lookupAcceptance(loadAcceptance(db), {
      matrixLevel: assessment.matrix_level as MatrixLevel,
      durationText,
      publicExposed,
      gradeText: actor.gradeText,
    });
    const decisionId = randomUUID();
    const createdAt = now();
    db.prepare(
      `INSERT INTO risk_decision (
         id, organization_id, assessment_id, decision, decided_by, grade_text, duration_text, public_exposed, created_at, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      decisionId,
      assessment.organization_id,
      assessment.id,
      decision,
      actor.id,
      actor.gradeText,
      durationText,
      publicExposed ? 1 : 0,
      createdAt,
      actor.id,
    );
    const checkId = randomUUID();
    db.prepare(
      `INSERT INTO authority_check (id, organization_id, decision_id, result, basis, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      checkId,
      assessment.organization_id,
      decisionId,
      authority.result,
      authority.basis,
      createdAt,
      actor.id,
    );
    const stored = getOne(db, "risk_assessment", assessment.id);
    res.status(201).json({
      decision: publicDecision(getOne(db, "risk_decision", decisionId)),
      authorityCheck: publicAuthority(getOne(db, "authority_check", checkId)),
      matrixLevel: stored.matrix_level,
      matrixCell: stored.matrix_cell,
    });
  }));

  app.post("/findings/:id/actions", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const finding = mustFinding(db, routeId(req.params.id), actor);
    const body = bodyOf(req);
    const ownerUserId = requireString(body, "ownerUserId");
    const owner = db.prepare("SELECT organization_id FROM user WHERE id = ?").get(ownerUserId) as
      | { organization_id: string }
      | undefined;
    if (!owner || owner.organization_id !== finding.organization_id) {
      throw new HttpError(400, "the assigned person is not in this organization");
    }
    const hazardId = requireString(body, "hazardId");
    const hazard = mustGet(db, "hazard", hazardId, actor);
    const linked = db
      .prepare("SELECT 1 AS ok FROM finding_hazard WHERE finding_id = ? AND hazard_id = ?")
      .get(finding.id, hazard.id) as { ok: number } | undefined;
    if (!linked) {
      throw new HttpError(409, "that hazard is not linked to this finding");
    }
    const id = randomUUID();
    db.prepare(
      `INSERT INTO corrective_action (
         id, organization_id, finding_id, hazard_id, description, owner_user_id, due_on, status, kind, completed_by, created_at, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, NULL, ?, ?)`,
    ).run(
      id,
      finding.organization_id,
      finding.id,
      hazard.id,
      requireString(body, "description"),
      ownerUserId,
      optionalString(body, "dueOn"),
      requireEnum(body, "kind", ["corrective", "preventive"]),
      now(),
      actor.id,
    );
    setFindingStatus(db, finding, "action in progress", actor.id, "action assigned");
    res.status(201).json(getOne(db, "corrective_action", id));
  }));

  app.post("/actions/:id/complete", wrap((req, res) => {
    const actor = requireActor(db, req);
    const action = mustGet(db, "corrective_action", routeId(req.params.id), actor);
    if (action.owner_user_id !== actor.id) {
      throw new HttpError(403, "only the assigned person can complete this action");
    }
    if (action.status === "closed") {
      throw new HttpError(409, "a closed action stays closed");
    }
    db.prepare("UPDATE corrective_action SET status = 'completed', completed_by = ? WHERE id = ?").run(
      actor.id,
      action.id,
    );
    recordEvent(db, action.organization_id, "corrective_action", action.id, action.status ?? null, "completed", actor.id, null);
    res.json(getOne(db, "corrective_action", action.id));
  }));

  app.post("/actions/:id/evidence", wrap((req, res) => {
    const actor = requireActor(db, req);
    const action = mustGet(db, "corrective_action", routeId(req.params.id), actor);
    const body = bodyOf(req);
    const id = randomUUID();
    const uploadedAt = now();
    db.prepare(
      `INSERT INTO evidence (id, organization_id, action_id, file_name, content_hash, uploaded_by, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      action.organization_id,
      action.id,
      requireString(body, "fileName"),
      requireString(body, "contentHash"),
      actor.id,
      uploadedAt,
    );
    res.status(201).json(getOne(db, "evidence", id));
  }));

  app.post("/actions/:id/verifications", wrap((req, res) => {
    const actor = requireActor(db, req);
    const action = mustGet(db, "corrective_action", routeId(req.params.id), actor);
    if (action.completed_by === actor.id) {
      throw new HttpError(403, "the user who completed the action cannot verify it");
    }
    if (action.status !== "completed") {
      throw new HttpError(409, "verification follows a completed action");
    }
    const body = bodyOf(req);
    const result = requireEnum(body, "result", ["pass", "fail"]);
    const id = randomUUID();
    db.prepare(
      `INSERT INTO verification (id, organization_id, action_id, result, notes, verifier_user_id, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      action.organization_id,
      action.id,
      result,
      optionalString(body, "notes"),
      actor.id,
      now(),
      actor.id,
    );
    if (result === "fail") {
      db.prepare("UPDATE corrective_action SET status = 'open', completed_by = NULL WHERE id = ?").run(action.id);
      recordEvent(
        db,
        action.organization_id,
        "corrective_action",
        action.id,
        "completed",
        "open",
        actor.id,
        "verification failed",
      );
    }
    res.status(201).json(getOne(db, "verification", id));
  }));

  app.post("/actions/:id/close", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const action = mustGet(db, "corrective_action", routeId(req.params.id), actor);
    const latest = db
      .prepare(
        "SELECT result FROM verification WHERE action_id = ? ORDER BY created_at DESC LIMIT 1",
      )
      .get(action.id) as { result: string } | undefined;
    if (!latest || latest.result !== "pass") {
      throw new HttpError(409, "a passed verification is required before close");
    }
    db.prepare("UPDATE corrective_action SET status = 'closed' WHERE id = ?").run(action.id);
    recordEvent(db, action.organization_id, "corrective_action", action.id, action.status ?? null, "closed", actor.id, null);
    if (!action.finding_id) {
      throw new HttpError(500, "server error");
    }
    const finding = mustFinding(db, action.finding_id, actor);
    const actions = db
      .prepare("SELECT status FROM corrective_action WHERE finding_id = ?")
      .all(finding.id) as Array<{ status: string }>;
    const nextStatus: FindingStatus = actions.every((row) => row.status === "closed")
      ? "action closed"
      : "action in progress";
    setFindingStatus(db, finding, nextStatus, actor.id, "action closed");
    const reread = mustFinding(db, finding.id, actor);
    res.json({
      action: getOne(db, "corrective_action", action.id),
      finding: publicFinding(reread),
    });
  }));

  app.use((_req, res) => {
    res.status(404).json({ error: "not found" });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof Error && error.message.includes("do not match a matrix cell")) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "server error" });
  });

  return { app, db };
}

function wrap(fn: (req: Request, res: Response) => void) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      fn(req, res);
    } catch (error) {
      next(error);
    }
  };
}

function now(): string {
  return new Date().toISOString();
}

function bodyOf(req: Request): Record<string, unknown> {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    return req.body as Record<string, unknown>;
  }
  return {};
}

function routeId(value: string | string[] | undefined): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpError(400, "missing id");
  }
  return value;
}

function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${key} is required`);
  }
  return value.trim();
}

function optionalString(body: Record<string, unknown>, key: string): string | null {
  if (!(key in body) || body[key] === null) {
    return null;
  }
  return requireString(body, key);
}

function requireBoolean(body: Record<string, unknown>, key: string): boolean {
  if (typeof body[key] !== "boolean") {
    throw new HttpError(400, `${key} is required`);
  }
  return body[key] as boolean;
}

function requireEnum(body: Record<string, unknown>, key: string, allowed: string[]): string {
  const value = requireString(body, key);
  if (!allowed.includes(value)) {
    throw new HttpError(400, `${key} is not one of the allowed values`);
  }
  return value;
}

function optionalEnum(body: Record<string, unknown>, key: string, allowed: string[]): string | null {
  if (!(key in body) || body[key] === null) {
    return null;
  }
  return requireEnum(body, key, allowed);
}

function rejectProgramArea(body: Record<string, unknown>): void {
  if ("programArea" in body && body.programArea !== null) {
    throw new HttpError(400, "program area is not part of this milestone");
  }
}

function rejectOverride(body: Record<string, unknown>): void {
  for (const key of ["override", "waiver", "delegation"]) {
    if (key in body) {
      throw new HttpError(400, "override, waiver, and delegation are not available");
    }
  }
}

function requireOriginalText(body: Record<string, unknown>): string {
  rejectProgramArea(body);
  rejectOverride(body);
  return requireString(body, "originalText");
}

function requireActor(db: DatabaseSync, req: Request): Actor {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!token) {
    throw new HttpError(401, "a session token is required");
  }
  const user = db
    .prepare(
      `SELECT u.id, u.display_name, u.grade_text
       FROM session s JOIN user u ON u.id = s.user_id
       WHERE s.token = ?`,
    )
    .get(token) as { id: string; display_name: string; grade_text: string | null } | undefined;
  if (!user) {
    throw new HttpError(401, "a session token is required");
  }
  const roles = db
    .prepare(
      `SELECT r.name AS role, ur.organization_id
       FROM user_role ur JOIN role r ON r.id = ur.role_id
       WHERE ur.user_id = ?`,
    )
    .all(user.id) as Array<{ role: string; organization_id: string }>;
  const organizationIds = new Set<string>();
  for (const role of roles) {
    const tree = db
      .prepare(
        `WITH RECURSIVE orgs(id) AS (
           SELECT id FROM organization WHERE id = ?
           UNION
           SELECT child.id FROM organization child JOIN orgs ON child.parent_id = orgs.id
         )
         SELECT id FROM orgs`,
      )
      .all(role.organization_id) as Array<{ id: string }>;
    for (const org of tree) {
      organizationIds.add(org.id);
    }
  }
  return {
    id: user.id,
    displayName: user.display_name,
    gradeText: user.grade_text,
    roles: roles.map((role) => role.role),
    organizationIds: [...organizationIds],
  };
}

function requireRole(actor: Actor, role: string): void {
  if (!actor.roles.includes(role)) {
    throw new HttpError(403, `${role} is required`);
  }
}

function homeOrg(actor: Actor): string {
  const org = actor.organizationIds[0];
  if (!org) {
    throw new HttpError(403, "this user has no organization");
  }
  return org;
}

function mustGet(
  db: DatabaseSync,
  table: string,
  id: string,
  actor: Actor,
): Record<string, string | null> & { id: string; organization_id: string; status?: string } {
  if (!/^[a-z_]+$/.test(table)) {
    throw new HttpError(500, "server error");
  }
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as
    | (Record<string, string | null> & { id: string; organization_id: string })
    | undefined;
  if (!row || !actor.organizationIds.includes(row.organization_id)) {
    throw new HttpError(404, "record not found");
  }
  return row;
}

function mustFinding(db: DatabaseSync, id: string, actor: Actor): FindingRow {
  const row = db.prepare("SELECT * FROM finding WHERE id = ?").get(id) as FindingRow | undefined;
  if (!row || !actor.organizationIds.includes(row.organization_id)) {
    throw new HttpError(404, "record not found");
  }
  return row;
}

function getOne(db: DatabaseSync, table: string, id: string): Record<string, unknown> {
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Record<string, unknown>;
}

function listScoped(db: DatabaseSync, actor: Actor, table: string, orderBy: string): Record<string, unknown>[] {
  if (actor.organizationIds.length === 0) {
    return [];
  }
  const placeholders = actor.organizationIds.map(() => "?").join(", ");
  return db
    .prepare(`SELECT * FROM ${table} WHERE organization_id IN (${placeholders}) ORDER BY ${orderBy}`)
    .all(...actor.organizationIds) as Record<string, unknown>[];
}

function insertFinding(
  db: DatabaseSync,
  actor: Actor,
  input: {
    organizationId: string;
    originalText: string;
    sourceObservationId: string | null;
    sourceReportId: string | null;
  },
): FindingRow {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO finding (
       id, organization_id, original_text, status, source_observation_id, source_report_id, program_area, created_at, created_by
     ) VALUES (?, ?, ?, 'open', ?, ?, NULL, ?, ?)`,
  ).run(id, input.organizationId, input.originalText, input.sourceObservationId, input.sourceReportId, now(), actor.id);
  recordEvent(db, input.organizationId, "finding", id, null, "open", actor.id, null);
  return mustFinding(db, id, actor);
}

function setFindingStatus(db: DatabaseSync, finding: FindingRow, status: FindingStatus, actorId: string, reason: string): void {
  if (finding.status === status) {
    return;
  }
  db.prepare("UPDATE finding SET status = ? WHERE id = ?").run(status, finding.id);
  recordEvent(db, finding.organization_id, "finding", finding.id, finding.status, status, actorId, reason);
  finding.status = status;
}

function recordEvent(
  db: DatabaseSync,
  organizationId: string,
  recordType: string,
  recordId: string,
  fromStatus: string | null,
  toStatus: string,
  actorId: string,
  reason: string | null,
): void {
  db.prepare(
    `INSERT INTO record_event (
       id, organization_id, record_type, record_id, from_status, to_status, actor_user_id, created_at, reason
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), organizationId, recordType, recordId, fromStatus, toStatus, actorId, now(), reason);
}

function loadMatrix(db: DatabaseSync): MatrixCell[] {
  const rows = db
    .prepare(
      "SELECT probability_code, severity_code, matrix_cell, matrix_level, doctrine_ref FROM risk_matrix_cell",
    )
    .all() as Array<{
    probability_code: MatrixCell["probabilityCode"];
    severity_code: MatrixCell["severityCode"];
    matrix_cell: string;
    matrix_level: MatrixLevel;
    doctrine_ref: string;
  }>;
  return rows.map((row) => ({
    probabilityCode: row.probability_code,
    severityCode: row.severity_code,
    matrixCell: row.matrix_cell,
    matrixLevel: row.matrix_level,
    doctrineRef: row.doctrine_ref,
  }));
}

function loadAcceptance(db: DatabaseSync): AcceptanceCell[] {
  const rows = db
    .prepare(
      "SELECT matrix_level, duration_text, public_exposed, grade_text, basis FROM risk_acceptance_cell",
    )
    .all() as Array<{
    matrix_level: MatrixLevel;
    duration_text: DurationText;
    public_exposed: number;
    grade_text: string;
    basis: string;
  }>;
  return rows.map((row) => ({
    id: row.basis,
    matrixLevel: row.matrix_level,
    durationText: row.duration_text,
    publicExposed: row.public_exposed === 1,
    gradeText: row.grade_text,
    basis: row.basis,
  }));
}

function publicFinding(row: FindingRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    originalText: row.original_text,
    status: row.status,
    sourceObservationId: row.source_observation_id,
    sourceReportId: row.source_report_id,
    programArea: null,
  };
}

function publicReport(row: Record<string, unknown>) {
  const showName = row.show_name === 1;
  return {
    id: row.id,
    organizationId: row.organization_id,
    text: row.text,
    reporterDisplayName: showName ? row.reporter_display_name : null,
    showName,
  };
}

function publicAssessment(row: Record<string, unknown>) {
  return {
    id: row.id,
    hazardId: row.hazard_id,
    phase: row.phase,
    probabilityCode: row.probability_code,
    severityCode: row.severity_code,
    matrixLevel: row.matrix_level,
    matrixCell: row.matrix_cell,
    doctrineRef: row.doctrine_ref,
    estimatedBy: row.estimated_by,
  };
}

function publicDecision(row: Record<string, unknown>) {
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    decision: row.decision,
    decidedBy: row.decided_by,
    gradeText: row.grade_text,
    durationText: row.duration_text,
    publicExposed: row.public_exposed === 1,
  };
}

function publicAuthority(row: Record<string, unknown>) {
  return {
    id: row.id,
    decisionId: row.decision_id,
    result: row.result,
    basis: row.basis,
  };
}

function findingChain(db: DatabaseSync, finding: FindingRow) {
  const hazards = db
    .prepare(
      `SELECT h.* FROM hazard h
       JOIN finding_hazard link ON link.hazard_id = h.id
       WHERE link.finding_id = ?`,
    )
    .all(finding.id) as Array<{ id: string }>;
  const hazardIds = hazards.map((hazard) => hazard.id);
  const assessments = hazardIds.length
    ? db
        .prepare(
          `SELECT * FROM risk_assessment WHERE hazard_id IN (${hazardIds.map(() => "?").join(", ")}) ORDER BY created_at`,
        )
        .all(...hazardIds)
    : [];
  const assessmentIds = (assessments as Array<{ id: string }>).map((row) => row.id);
  const controls = assessmentIds.length
    ? db
        .prepare(
          `SELECT * FROM control WHERE assessment_id IN (${assessmentIds.map(() => "?").join(", ")})`,
        )
        .all(...assessmentIds)
    : [];
  const decisions = assessmentIds.length
    ? db
        .prepare(
          `SELECT * FROM risk_decision WHERE assessment_id IN (${assessmentIds.map(() => "?").join(", ")}) ORDER BY created_at`,
        )
        .all(...assessmentIds)
    : [];
  const decisionIds = (decisions as Array<{ id: string }>).map((row) => row.id);
  const authorityChecks = decisionIds.length
    ? db
        .prepare(
          `SELECT * FROM authority_check WHERE decision_id IN (${decisionIds.map(() => "?").join(", ")})`,
        )
        .all(...decisionIds)
    : [];
  const actions = db.prepare("SELECT * FROM corrective_action WHERE finding_id = ?").all(finding.id) as Array<{
    id: string;
  }>;
  const actionIds = actions.map((action) => action.id);
  const verifications = actionIds.length
    ? db
        .prepare(
          `SELECT * FROM verification WHERE action_id IN (${actionIds.map(() => "?").join(", ")}) ORDER BY created_at`,
        )
        .all(...actionIds)
    : [];
  return {
    finding: publicFinding(finding),
    hazards,
    assessments: (assessments as Record<string, unknown>[]).map(publicAssessment),
    controls,
    decisions: (decisions as Record<string, unknown>[]).map(publicDecision),
    authorityChecks: (authorityChecks as Record<string, unknown>[]).map(publicAuthority),
    actions,
    verifications,
  };
}
