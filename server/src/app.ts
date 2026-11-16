import { createHash, randomBytes, randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import {
  ATP_CONTROL_CATEGORIES,
  DECISIONS,
  DURATIONS,
  HIERARCHY_STEPS,
  PROGRAM_AREAS,
  WASTE_KINDS,
  type DurationText,
  type FindingStatus,
  type MatrixLevel,
} from "../../shared/src/index.ts";
import { openDatabase } from "./db.ts";
import {
  FIRE_KINDS,
  MISHAP_NOTICE,
  MISHAP_OUTCOMES,
  PERSONNEL_CATEGORIES,
  SPILL_STEPS,
  TRAINING_TOPICS,
} from "./army.ts";
import { CHECKLISTS, LIBRARY } from "./library.ts";
import {
  lookupAcceptance,
  lookupMatrix,
  type AcceptanceCell,
  type MatrixCell,
} from "./doctrine.ts";
import { verifyPassword } from "./passwords.ts";
import { buildQuestionPrompt, callXai, checkReply, type SuppliedRecord } from "./ai.ts";
import type { SourceCard } from "./sources.ts";

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

export function createApp(
  dbPath: string,
  options?: { complete?: (prompt: string) => Promise<string> },
): { app: express.Express; db: DatabaseSync } {
  const db = openDatabase(dbPath);
  const app = express();
  app.use(express.json({ limit: "2mb" }));
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
    res.status(201).json({
      token,
      userId: user.id,
      displayName: user.display_name,
      gradeText: user.grade_text,
      roles: roleNames(db, user.id),
    });
  }));

  app.get("/inspections", wrap((req, res) => {
    const actor = requireActor(db, req);
    const rows = listScoped(db, actor, "inspection", "inspected_on DESC");
    res.json({ inspections: rows.map(publicInspection) });
  }));

  app.get("/work", wrap((req, res) => {
    const actor = requireActor(db, req);
    const ids = actor.organizationIds;
    if (ids.length === 0) {
      res.json({ inspections: [], findings: [], overdue: [] });
      return;
    }
    const inspections = listScoped(db, actor, "inspection", "inspected_on DESC").map(publicInspection);
    const rows = findingWorkRows(db, ids);
    const today = localDate();
    const overdue = overdueInScope(db, ids, today);
    res.json({
      inspections,
      findings: rows.map(publicWorkFinding),
      overdue,
    });
  }));

  app.get("/organizations", wrap((req, res) => {
    const actor = requireActor(db, req);
    if (actor.organizationIds.length === 0) {
      res.json({ organizations: [] });
      return;
    }
    const placeholders = actor.organizationIds.map(() => "?").join(", ");
    const rows = db
      .prepare(`SELECT id, name FROM organization WHERE id IN (${placeholders}) ORDER BY name`)
      .all(...actor.organizationIds) as Array<{ id: string; name: string }>;
    res.json({ organizations: rows });
  }));

  app.get("/checklists", wrap((req, res) => {
    requireActor(db, req);
    res.json({ checklists: CHECKLISTS });
  }));

  app.get("/library", wrap((req, res) => {
    requireActor(db, req);
    res.json({
      notice: "Names a shop can pick. A safety data sheet is not stored. A job step does not set a risk level.",
      entries: LIBRARY,
    });
  }));

  app.get("/comparison", wrap((req, res) => {
    const actor = requireActor(db, req);
    if (!actor.roles.includes("safety officer") && !actor.roles.includes("commander")) {
      throw new HttpError(403, "safety officer or commander is required");
    }
    res.json({
      notice: "Counts of records at each camp. Not a score and not a rate. The words of another camp's findings are not included.",
      camps: campCounts(db, localDate()),
    });
  }));

  app.post("/checklist-walks", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const body = bodyOf(req);
    const checklist = CHECKLISTS.find((item) => item.id === body.checklistId);
    if (!checklist) {
      throw new HttpError(400, "checklist not found");
    }
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const byId = new Map<string, boolean>();
    for (const answer of answers) {
      if (!answer || typeof answer !== "object") {
        throw new HttpError(400, "each line needs a pass or a fail");
      }
      const row = answer as { itemId?: unknown; passed?: unknown };
      if (typeof row.itemId !== "string" || typeof row.passed !== "boolean") {
        throw new HttpError(400, "each line needs a pass or a fail");
      }
      byId.set(row.itemId, row.passed);
    }
    for (const item of checklist.items) {
      if (!byId.has(item.id)) {
        throw new HttpError(400, "each line needs a pass or a fail");
      }
    }
    const organizationId = typeof body.organizationId === "string" ? body.organizationId : homeOrg(actor);
    if (!actor.organizationIds.includes(organizationId)) {
      throw new HttpError(404, "record not found");
    }
    const inspectedOn = requireString(body, "inspectedOn");
    const inspectionId = randomUUID();
    const stamp = now();
    db.prepare(
      `INSERT INTO inspection (id, organization_id, shop_name, inspected_on, inspector_user_id, status, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`,
    ).run(inspectionId, organizationId, checklist.shopName, inspectedOn, actor.id, stamp, actor.id);
    const findings: Array<{ id: string; originalText: string }> = [];
    for (const item of checklist.items) {
      const passed = byId.get(item.id) === true;
      let findingId: string | null = null;
      if (!passed) {
        const observationId = randomUUID();
        db.prepare(
          `INSERT INTO observation (id, organization_id, inspection_id, text, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(observationId, organizationId, inspectionId, item.text, stamp, actor.id);
        const finding = insertFinding(db, actor, {
          organizationId,
          originalText: item.text,
          sourceObservationId: observationId,
          sourceReportId: null,
        });
        findingId = finding.id;
        findings.push({ id: finding.id, originalText: finding.original_text });
      }
      db.prepare(
        `INSERT INTO inspection_line (id, organization_id, inspection_id, item_text, result, finding_id, created_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(randomUUID(), organizationId, inspectionId, item.text, passed ? "pass" : "fail", findingId, stamp, actor.id);
    }
    res.status(201).json({ inspectionId, findings });
  }));

  app.get("/inspections/:id", wrap((req, res) => {
    const actor = requireActor(db, req);
    const inspection = mustGet(db, "inspection", routeId(req.params.id), actor);
    const observations = db
      .prepare("SELECT * FROM observation WHERE inspection_id = ? ORDER BY created_at")
      .all(inspection.id) as Record<string, unknown>[];
    const findings = db
      .prepare(
        `SELECT finding.* FROM finding
         JOIN observation ON observation.id = finding.source_observation_id
         WHERE observation.inspection_id = ?
         ORDER BY finding.created_at`,
      )
      .all(inspection.id) as FindingRow[];
    res.json({
      inspection: publicInspection(inspection),
      observations: observations.map(publicObservation),
      findings: findings.map(publicFinding),
    });
  }));

  app.get("/users", wrap((req, res) => {
    const actor = requireActor(db, req);
    if (actor.organizationIds.length === 0) {
      res.json({ users: [] });
      return;
    }
    const placeholders = actor.organizationIds.map(() => "?").join(", ");
    const users = db
      .prepare(
        `SELECT id, display_name, grade_text, organization_id FROM user
         WHERE organization_id IN (${placeholders}) ORDER BY display_name`,
      )
      .all(...actor.organizationIds) as Array<{
      id: string;
      display_name: string;
      grade_text: string | null;
      organization_id: string;
    }>;
    res.json({
      users: users.map((user) => ({
        id: user.id,
        displayName: user.display_name,
        gradeText: user.grade_text,
        organizationId: user.organization_id,
        roles: roleNames(db, user.id),
      })),
    });
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
    res.status(201).json(publicInspection(getOne(db, "inspection", id)));
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
    res.json(publicInspection(getOne(db, "inspection", inspection.id)));
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
    res.status(201).json(publicObservation(getOne(db, "observation", id)));
  }));

  app.post("/employee-reports", wrap((req, res) => {
    const actor = requireActor(db, req);
    const body = bodyOf(req);
    const text = requireString(body, "text");
    const showName = body.showName === true;
    const reporterDisplayName = showName
      ? (optionalString(body, "reporterDisplayName") ?? actor.displayName)
      : null;
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

  app.get("/employee-reports/:id", wrap((req, res) => {
    const actor = requireActor(db, req);
    const report = mustGet(db, "employee_report", routeId(req.params.id), actor);
    const findings = db
      .prepare("SELECT * FROM finding WHERE source_report_id = ? ORDER BY created_at")
      .all(report.id) as FindingRow[];
    res.json({
      report: publicReport(report),
      findings: findings.map(publicFinding),
    });
  }));

  app.get("/obligations", wrap((req, res) => {
    const actor = requireActor(db, req);
    res.json({ obligations: listScoped(db, actor, "obligation", "created_at DESC").map(publicObligation) });
  }));

  app.post("/obligations", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const body = bodyOf(req);
    rejectCompliance(body);
    const id = randomUUID();
    const organizationId = homeOrg(actor);
    db.prepare(
      `INSERT INTO obligation (id, organization_id, title, applicability_text, program_area, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      organizationId,
      requireString(body, "title"),
      requireString(body, "applicabilityText"),
      requireEnum(body, "programArea", [...PROGRAM_AREAS]),
      now(),
      actor.id,
    );
    res.status(201).json(publicObligation(getOne(db, "obligation", id)));
  }));

  app.get("/obligations/:id", wrap((req, res) => {
    const actor = requireActor(db, req);
    const obligation = mustGet(db, "obligation", routeId(req.params.id), actor);
    res.json({ obligation: publicObligation(obligation), findings: linkedFindings(db, "obligation_finding", "obligation_id", obligation.id) });
  }));

  app.post("/obligations/:id/findings", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const obligation = mustGet(db, "obligation", routeId(req.params.id), actor);
    const finding = insertFinding(db, actor, {
      organizationId: obligation.organization_id,
      originalText: requireOriginalText(bodyOf(req)),
      sourceObservationId: null,
      sourceReportId: null,
      programArea: String(obligation.program_area),
    });
    db.prepare("INSERT INTO obligation_finding (obligation_id, finding_id) VALUES (?, ?)").run(obligation.id, finding.id);
    res.status(201).json(publicFinding(finding));
  }));

  app.get("/waste-streams", wrap((req, res) => {
    const actor = requireActor(db, req);
    res.json({ wasteStreams: listScoped(db, actor, "waste_stream", "created_at DESC").map(publicWaste) });
  }));

  app.post("/waste-streams", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const body = bodyOf(req);
    rejectCompliance(body);
    const obligationId = optionalString(body, "obligationId");
    if (obligationId) {
      mustGet(db, "obligation", obligationId, actor);
    }
    const id = randomUUID();
    const organizationId = homeOrg(actor);
    db.prepare(
      `INSERT INTO waste_stream (id, organization_id, obligation_id, name, waste_kind, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      organizationId,
      obligationId,
      requireString(body, "name"),
      requireEnum(body, "wasteKind", [...WASTE_KINDS]),
      now(),
      actor.id,
    );
    res.status(201).json(publicWaste(getOne(db, "waste_stream", id)));
  }));

  app.get("/waste-streams/:id", wrap((req, res) => {
    const actor = requireActor(db, req);
    const waste = mustGet(db, "waste_stream", routeId(req.params.id), actor);
    res.json({ wasteStream: publicWaste(waste), findings: linkedFindings(db, "waste_stream_finding", "waste_stream_id", waste.id) });
  }));

  app.post("/waste-streams/:id/findings", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const waste = mustGet(db, "waste_stream", routeId(req.params.id), actor);
    const finding = insertFinding(db, actor, {
      organizationId: waste.organization_id,
      originalText: requireOriginalText(bodyOf(req)),
      sourceObservationId: null,
      sourceReportId: null,
      programArea: "waste",
    });
    db.prepare("INSERT INTO waste_stream_finding (waste_stream_id, finding_id) VALUES (?, ?)").run(waste.id, finding.id);
    res.status(201).json(publicFinding(finding));
  }));

  app.get("/materials", wrap((req, res) => {
    const actor = requireActor(db, req);
    res.json({
      notice: "The inventory says where the safety data sheet is kept. The sheet itself is not stored, and this record is not a cleanup procedure.",
      materials: listScoped(db, actor, "hazardous_material", "name ASC").map(publicMaterial),
    });
  }));

  app.post("/materials", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const body = bodyOf(req);
    rejectMaterialExtras(body);
    const id = randomUUID();
    db.prepare(
      `INSERT INTO hazardous_material (id, organization_id, name, storage_place, sheet_place, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      homeOrg(actor),
      requireString(body, "name"),
      requireString(body, "storagePlace"),
      requireString(body, "sheetPlace"),
      now(),
      actor.id,
    );
    res.status(201).json(publicMaterial(getOne(db, "hazardous_material", id)));
  }));

  app.get("/materials/:id", wrap((req, res) => {
    const actor = requireActor(db, req);
    const material = mustGet(db, "hazardous_material", routeId(req.params.id), actor);
    res.json({
      material: publicMaterial(material),
      findings: linkedFindings(db, "hazardous_material_finding", "material_id", material.id),
    });
  }));

  app.post("/materials/:id/findings", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const material = mustGet(db, "hazardous_material", routeId(req.params.id), actor);
    const finding = insertFinding(db, actor, {
      organizationId: material.organization_id,
      originalText: requireOriginalText(bodyOf(req)),
      sourceObservationId: null,
      sourceReportId: null,
      programArea: "materials",
    });
    db.prepare("INSERT INTO hazardous_material_finding (material_id, finding_id) VALUES (?, ?)").run(material.id, finding.id);
    res.status(201).json(publicFinding(finding));
  }));

  app.get("/spills", wrap((req, res) => {
    const actor = requireActor(db, req);
    res.json({ spills: listScoped(db, actor, "spill", "created_at DESC").map((row) => publicSpill(db, row)) });
  }));

  app.post("/spills", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const body = bodyOf(req);
    rejectCompliance(body);
    rejectMaterialExtras(body);
    if ("mishapId" in body) {
      throw new HttpError(400, "record the mishap on its own. A spill does not assign a mishap class");
    }
    const materialId = materialInHome(db, actor, body.materialId);
    const id = randomUUID();
    db.prepare(
      `INSERT INTO spill (id, organization_id, material_id, description, reported_to, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, homeOrg(actor), materialId, requireString(body, "description"), requireString(body, "reportedTo"), now(), actor.id);
    res.status(201).json(publicSpill(db, getOne(db, "spill", id)));
  }));

  app.get("/spills/:id", wrap((req, res) => {
    const actor = requireActor(db, req);
    const spill = mustGet(db, "spill", routeId(req.params.id), actor);
    res.json({
      spill: publicSpill(db, spill),
      steps: spillSteps(db, spill.id),
      findings: linkedFindings(db, "spill_finding", "spill_id", spill.id),
    });
  }));

  app.post("/spills/:id/findings", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const spill = mustGet(db, "spill", routeId(req.params.id), actor);
    const finding = insertFinding(db, actor, {
      organizationId: spill.organization_id,
      originalText: requireOriginalText(bodyOf(req)),
      sourceObservationId: null,
      sourceReportId: null,
      programArea: "tanks and spills",
    });
    db.prepare("INSERT INTO spill_finding (spill_id, finding_id) VALUES (?, ?)").run(spill.id, finding.id);
    res.status(201).json(publicFinding(finding));
  }));

  app.post("/spills/:id/steps", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const spill = mustGet(db, "spill", routeId(req.params.id), actor);
    const body = bodyOf(req);
    rejectCompliance(body);
    const step = requireEnum(body, "step", [...SPILL_STEPS]);
    const id = randomUUID();
    try {
      db.prepare(
        `INSERT INTO spill_response (id, organization_id, spill_id, step, note, created_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, spill.organization_id, spill.id, step, requireString(body, "note"), now(), actor.id);
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        throw new HttpError(400, "that cleanup step is already recorded");
      }
      throw error;
    }
    res.status(201).json({ id, step, note: requireString(body, "note") });
  }));

  app.get("/mishaps", wrap((req, res) => {
    const actor = requireActor(db, req);
    res.json({
      notice: MISHAP_NOTICE,
      mishaps: listScoped(db, actor, "mishap", "occurred_on DESC").map(publicMishap),
    });
  }));

  app.post("/mishaps", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const body = bodyOf(req);
    rejectMishapExtras(body);
    const id = randomUUID();
    const occurredOn = requireDate(body, "occurredOn");
    const personnelCategory = requireEnum(body, "personnelCategory", [...PERSONNEL_CATEGORIES]);
    const outcome = requireEnum(body, "outcome", [...MISHAP_OUTCOMES]);
    db.prepare(
      `INSERT INTO mishap (id, organization_id, occurred_on, narrative, personnel_category, outcome, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, homeOrg(actor), occurredOn, requireString(body, "narrative"), personnelCategory, outcome, now(), actor.id);
    res.status(201).json({ notice: MISHAP_NOTICE, clock: mishapClock(personnelCategory, outcome), mishap: publicMishap(getOne(db, "mishap", id)) });
  }));

  app.get("/mishaps/:id", wrap((req, res) => {
    const actor = requireActor(db, req);
    const mishap = mustGet(db, "mishap", routeId(req.params.id), actor);
    const row = publicMishap(mishap);
    res.json({
      notice: MISHAP_NOTICE,
      clock: mishapClock(row.personnelCategory, row.outcome),
      mishap: row,
      findings: linkedFindings(db, "mishap_finding", "mishap_id", mishap.id),
    });
  }));

  app.post("/mishaps/:id/findings", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const mishap = mustGet(db, "mishap", routeId(req.params.id), actor);
    const finding = insertFinding(db, actor, {
      organizationId: mishap.organization_id,
      originalText: requireOriginalText(bodyOf(req)),
      sourceObservationId: null,
      sourceReportId: null,
    });
    db.prepare("INSERT INTO mishap_finding (mishap_id, finding_id) VALUES (?, ?)").run(mishap.id, finding.id);
    res.status(201).json(publicFinding(finding));
  }));

  app.get("/training", wrap((req, res) => {
    const actor = requireActor(db, req);
    res.json({ sessions: listScoped(db, actor, "training_session", "due_on DESC").map(publicTraining) });
  }));

  app.post("/training", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const body = bodyOf(req);
    rejectTrainingExtras(body);
    const topic = requireEnum(body, "topic", Object.keys(TRAINING_TOPICS));
    const headcount = Number(body.headcount);
    if (!Number.isInteger(headcount) || headcount < 1) throw new HttpError(400, "headcount must be a whole number of people");
    const completedOn = body.completedOn == null || body.completedOn === "" ? null : requireDate(body, "completedOn");
    const id = randomUUID();
    db.prepare(
      `INSERT INTO training_session (id, organization_id, topic, audience, due_on, completed_on, headcount, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, homeOrg(actor), topic, requireString(body, "audience"), requireDate(body, "dueOn"), completedOn, headcount, now(), actor.id);
    res.status(201).json(publicTraining(getOne(db, "training_session", id)));
  }));

  app.get("/training/:id", wrap((req, res) => {
    const actor = requireActor(db, req);
    const session = mustGet(db, "training_session", routeId(req.params.id), actor);
    res.json({ session: publicTraining(session), findings: linkedFindings(db, "training_finding", "training_id", session.id) });
  }));

  app.post("/training/:id/findings", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const session = mustGet(db, "training_session", routeId(req.params.id), actor);
    const finding = insertFinding(db, actor, {
      organizationId: session.organization_id,
      originalText: requireOriginalText(bodyOf(req)),
      sourceObservationId: null,
      sourceReportId: null,
    });
    db.prepare("INSERT INTO training_finding (training_id, finding_id) VALUES (?, ?)").run(session.id, finding.id);
    res.status(201).json(publicFinding(finding));
  }));

  app.get("/wildland-fires", wrap((req, res) => {
    const actor = requireActor(db, req);
    res.json({
      notice: "AR 200-1 treats a wildland fire as any non-structural fire on unimproved ground. That includes a wildfire and a prescribed burn. A prescribed burn is the Army term for a planned burn. Remediation is the work after the fire. This record does not store an ignition plan.",
      fires: listScoped(db, actor, "wildland_fire", "occurred_on DESC").map(publicFire),
    });
  }));

  app.post("/wildland-fires", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const body = bodyOf(req);
    rejectFireExtras(body);
    const id = randomUUID();
    db.prepare(
      `INSERT INTO wildland_fire (id, organization_id, kind, place, occurred_on, purpose, note, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      homeOrg(actor),
      requireEnum(body, "kind", [...FIRE_KINDS]),
      requireString(body, "place"),
      requireDate(body, "occurredOn"),
      requireString(body, "purpose"),
      requireString(body, "note"),
      now(),
      actor.id,
    );
    res.status(201).json(publicFire(getOne(db, "wildland_fire", id)));
  }));

  app.get("/wildland-fires/:id", wrap((req, res) => {
    const actor = requireActor(db, req);
    const fire = mustGet(db, "wildland_fire", routeId(req.params.id), actor);
    res.json({ fire: publicFire(fire), findings: linkedFindings(db, "wildland_fire_finding", "wildland_fire_id", fire.id) });
  }));

  app.post("/wildland-fires/:id/findings", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const fire = mustGet(db, "wildland_fire", routeId(req.params.id), actor);
    const finding = insertFinding(db, actor, {
      organizationId: fire.organization_id,
      originalText: requireOriginalText(bodyOf(req)),
      sourceObservationId: null,
      sourceReportId: null,
      programArea: fire.kind === "remediation" ? "cleanup" : "natural resources",
    });
    db.prepare("INSERT INTO wildland_fire_finding (wildland_fire_id, finding_id) VALUES (?, ?)").run(fire.id, finding.id);
    res.status(201).json(publicFinding(finding));
  }));

  app.get("/exposure-groups", wrap((req, res) => {
    const actor = requireActor(db, req);
    res.json({ exposureGroups: listScoped(db, actor, "exposure_group", "created_at DESC").map(publicExposure) });
  }));

  app.post("/exposure-groups", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const fields = requireExposure(bodyOf(req));
    const id = randomUUID();
    db.prepare(
      `INSERT INTO exposure_group (
         id, organization_id, agent, shop, control_method, headcount, exam_completion_percent, created_at, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      homeOrg(actor),
      fields.agent,
      fields.shop,
      fields.controlMethod,
      fields.headcount,
      fields.examCompletionPercent,
      now(),
      actor.id,
    );
    res.status(201).json(publicExposure(getOne(db, "exposure_group", id)));
  }));

  app.get("/exposure-groups/:id", wrap((req, res) => {
    const actor = requireActor(db, req);
    const group = mustGet(db, "exposure_group", routeId(req.params.id), actor);
    res.json({ exposureGroup: publicExposure(group) });
  }));

  app.get("/council", wrap((req, res) => {
    const actor = requireActor(db, req);
    const ids = actor.organizationIds;
    const today = localDate();
    const findingRows = findingWorkRows(db, ids).map(publicWorkFinding);
    const actionRows = orgRows(db, "corrective_action", "id, finding_id, description, status, due_on", ids, "created_at DESC");
    const inspectionRows = orgRows(db, "inspection", "id, shop_name, inspected_on, status", ids, "inspected_on DESC");
    const obligationRows = orgRows(db, "obligation", "id, title", ids, "created_at DESC");
    const wasteRows = orgRows(db, "waste_stream", "id, name", ids, "created_at DESC");
    const spillRows = orgRows(db, "spill", "id, description", ids, "created_at DESC");
    const materialRows = orgRows(db, "hazardous_material", "id, name, storage_place", ids, "name DESC");
    const mishapRows = orgRows(db, "mishap", "id, narrative, personnel_category, outcome", ids, "occurred_on DESC");
    const trainingRows = orgRows(db, "training_session", "id, topic, audience, due_on, completed_on", ids, "due_on DESC");
    const fireRows = orgRows(db, "wildland_fire", "id, kind, place", ids, "occurred_on DESC");
    const exposureRows = orgRows(db, "exposure_group", "id, agent, shop, headcount", ids, "created_at DESC");
    const actions = actionRows.map((row) => ({
      id: String(row.id),
      findingId: String(row.finding_id),
      label: String(row.description),
      status: String(row.status),
      dueOn: row.due_on == null ? null : String(row.due_on),
    }));
    const exposureGroups = exposureRows.map((row) => ({
      id: String(row.id),
      label: `${String(row.agent)} · ${String(row.shop)}`,
      headcount: Number(row.headcount),
    }));
    res.json({
      asOf: today,
      findings: tallyStatus(findingRows.map((row) => ({ status: String(row.status) }))),
      actions: tallyStatus(actions),
      inspections: tallyStatus(inspectionRows.map((row) => ({ status: String(row.status) }))),
      overdueActions: actions.filter((action) => action.dueOn != null && action.dueOn < today && action.status !== "closed"),
      exposureGroups: {
        groups: exposureGroups.length,
        people: exposureGroups.reduce((sum, group) => sum + group.headcount, 0),
      },
      obligations: obligationRows.length,
      wasteStreams: wasteRows.length,
      spills: spillRows.length,
      materials: materialRows.length,
      mishaps: mishapRows.length,
      training: trainingRows.length,
      wildlandFires: fireRows.length,
      records: {
        findings: findingRows.map((row) => ({
          id: row.id,
          label: row.originalText,
          status: row.status,
          step: row.step,
        })),
        actions,
        inspections: inspectionRows.map((row) => ({
          id: String(row.id),
          label: `${String(row.shop_name)} · ${String(row.inspected_on)}`,
          status: String(row.status),
        })),
        obligations: obligationRows.map((row) => ({ id: String(row.id), label: String(row.title) })),
        wasteStreams: wasteRows.map((row) => ({ id: String(row.id), label: String(row.name) })),
        spills: spillRows.map((row) => ({ id: String(row.id), label: String(row.description) })),
        materials: materialRows.map((row) => ({
          id: String(row.id),
          label: `${String(row.name)} · ${String(row.storage_place)}`,
        })),
        mishaps: mishapRows.map((row) => ({
          id: String(row.id),
          label: `${String(row.personnel_category)} · ${String(row.outcome)}`,
        })),
        training: trainingRows.map((row) => ({
          id: String(row.id),
          label: `${String(row.topic)} · ${String(row.audience)}`,
          dueOn: String(row.due_on),
          status: row.completed_on == null ? "open" : "complete",
        })),
        wildlandFires: fireRows.map((row) => ({
          id: String(row.id),
          label: `${String(row.kind)} · ${String(row.place)}`,
        })),
        exposureGroups,
      },
      notStored: [
        { item: "ASOHMS implementation status", reason: "Official criteria are not loaded." },
        {
          item: "Mishap class",
          reason: "DA Pam 385-40 class thresholds are not transcribed. The mishap narrative is stored without a class.",
        },
        {
          item: "RAC 1, 2, or 3 facility abatement",
          reason: "The RAC crosswalk is not verified. Matrix levels stay in ATP words on each finding.",
        },
        { item: "OSHA rates", reason: "The 29 CFR 1904 formulas have not been taken from the current text." },
        {
          item: "Council minutes",
          reason: "Minutes are not a SENTINEL record. Paragraph 1-17 says they are kept at least five years.",
        },
      ],
    });
  }));

  app.get("/asohms", wrap((req, res) => {
    const actor = requireActor(db, req);
    const rows = db.prepare(
      `SELECT o.id, o.regulation_letter, o.regulation_label, o.pamphlet_label, o.article_label,
              c.official_text, c.placeholder_note, s.practice_status, s.stage_label
       FROM asohms_objective o
       JOIN asohms_criterion c ON c.objective_id = o.id
       LEFT JOIN asohms_score s ON s.objective_id = o.id AND s.organization_id = ?
       ORDER BY o.sort_order`,
    ).all(homeOrg(actor)) as Array<Record<string, unknown>>;
    res.json({
      notice: "These practice notes are local learning records. SENTINEL does not produce an official Army assessment.",
      objectives: rows.map((row) => ({
        code: row.id,
        regulationLetter: row.regulation_letter,
        regulationLabel: row.regulation_label,
        pamphletLabel: row.pamphlet_label,
        articleLabel: row.article_label,
        officialText: row.official_text,
        placeholderNote: row.official_text === null ? row.placeholder_note : null,
        practiceStatus: row.practice_status ?? "not started",
        stageLabel: row.stage_label,
      })),
    });
  }));

  app.put("/asohms/:code/practice", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const code = routeId(req.params.code);
    const objective = db.prepare("SELECT id FROM asohms_objective WHERE id = ?").get(code) as { id: string } | undefined;
    if (!objective) throw new HttpError(404, "Objective not found");
    const body = bodyOf(req);
    for (const key of ["officialText", "official", "star", "certified", "headquartersEvaluation", "maturityRating", "isOfficialAssessment"]) {
      if (key in body) throw new HttpError(400, "A practice note cannot record an official assessment");
    }
    const practiceStatus = requireEnum(body, "practiceStatus", ["not started", "in progress", "complete"]);
    const stageLabel = optionalEnum(body, "stageLabel", [
      "documentation",
      "implementation and execution",
      "sustainment and continuous improvement",
    ]);
    const id = randomUUID();
    db.prepare(
      `INSERT INTO asohms_score (id, organization_id, objective_id, practice_status, stage_label, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (organization_id, objective_id) DO UPDATE SET
         practice_status = excluded.practice_status,
         stage_label = excluded.stage_label,
         updated_at = excluded.updated_at,
         updated_by = excluded.updated_by`,
    ).run(id, homeOrg(actor), code, practiceStatus, stageLabel, now(), actor.id);
    res.json({ code, practiceStatus, stageLabel });
  }));

  app.post("/questions", wrap(async (req, res) => {
    const actor = requireActor(db, req);
    const body = bodyOf(req);
    for (const key of Object.keys(body)) {
      if (key !== "question" && key !== "findingId") {
        throw new HttpError(400, `${key} is not part of a question`);
      }
    }
    const question = requireString(body, "question");
    if (question.length > 2000) throw new HttpError(400, "question is too long");
    const findingId = optionalString(body, "findingId");
    const packet = questionPacket(db, actor, findingId);
    const sources = loadSources(db);
    const prompt = buildQuestionPrompt({
      question,
      records: packet.records,
      recordIds: packet.recordIds,
      sources,
    });
    const complete = options?.complete ?? callXai;
    let replyText: string;
    try {
      replyText = await complete(prompt);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "The xAI key is not set on the server.") {
        throw new HttpError(503, message);
      }
      if (message.startsWith("The model call failed")) {
        throw new HttpError(502, message);
      }
      throw new HttpError(502, "The model call failed.");
    }
    const checked = checkReply(replyText, packet.labels, sources);
    const id = randomUUID();
    db.prepare(
      `INSERT INTO ai_exchange (
         id, organization_id, user_id, question, finding_id, record_ids, source_ids, reply_text, reply_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      homeOrg(actor),
      actor.id,
      question,
      findingId,
      JSON.stringify(packet.recordIds),
      JSON.stringify(sources.map((source) => source.id)),
      replyText,
      JSON.stringify(checked),
      now(),
    );
    res.status(201).json({
      id,
      question,
      notice: "This reply is stored text. It does not accept risk, assign an action, or close a record.",
      ...checked,
    });
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

  app.post("/findings/:id/authorizations", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const finding = mustFinding(db, routeId(req.params.id), actor);
    const body = bodyOf(req);
    for (const key of ["decision", "accept", "matrixLevel", "risk", "authority"]) {
      if (key in body) {
        throw new HttpError(400, "a work authorization is not a risk acceptance");
      }
    }
    const id = randomUUID();
    db.prepare(
      `INSERT INTO work_authorization (id, organization_id, finding_id, task_name, note, authorized_by, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, finding.organization_id, finding.id, requireString(body, "taskName"), requireString(body, "note"), actor.id, now(), actor.id);
    res.status(201).json({
      id,
      taskName: requireString(body, "taskName"),
      note: requireString(body, "note"),
      authorizedBy: actor.displayName,
    });
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
    if (action.owner_user_id !== actor.id) {
      throw new HttpError(403, "only the assigned person can attach evidence");
    }
    const body = bodyOf(req);
    const fileName = requireString(body, "fileName");
    const contentBase64 = requireString(body, "contentBase64").replace(/\s/g, "");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(contentBase64)) {
      throw new HttpError(400, "contentBase64 is not valid");
    }
    const bytes = Buffer.from(contentBase64, "base64");
    if (bytes.length === 0 || bytes.length > 1_000_000) {
      throw new HttpError(400, "the evidence file must be between 1 byte and 1 MB");
    }
    const id = randomUUID();
    db.prepare(
      `INSERT INTO evidence (id, organization_id, action_id, file_name, content_hash, uploaded_by, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      action.organization_id,
      action.id,
      fileName,
      createHash("sha256").update(bytes).digest("hex"),
      actor.id,
      now(),
    );
    res.status(201).json(publicEvidence(getOne(db, "evidence", id)));
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

function wrap(fn: (req: Request, res: Response) => unknown) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      Promise.resolve(fn(req, res)).catch(next);
    } catch (error) {
      next(error);
    }
  };
}

function loadSources(db: DatabaseSync): SourceCard[] {
  const rows = db.prepare("SELECT * FROM source_document ORDER BY id").all() as Array<Record<string, string>>;
  return rows.map((row) => ({
    id: row.id,
    publication: row.publication,
    authorityLayer: row.authority_layer,
    citation: row.citation,
    reviewStatus: row.review_status === "verified" ? "verified" : "unresolved",
    reviewedOn: row.reviewed_on,
    statement: row.statement,
    productLimit: row.product_limit,
  }));
}

function questionPacket(db: DatabaseSync, actor: Actor, findingId: string | null): {
  records: unknown;
  recordIds: string[];
  labels: SuppliedRecord[];
} {
  const findings = listScoped(db, actor, "finding", "created_at").map((row) => ({
    id: String(row.id),
    originalText: String(row.original_text),
    status: String(row.status),
    programArea: row.program_area,
  }));
  const exposures = listScoped(db, actor, "exposure_group", "created_at").map(publicExposure);
  const practice = db.prepare(
    `SELECT o.id, s.practice_status, s.stage_label
     FROM asohms_objective o
     LEFT JOIN asohms_score s ON s.objective_id = o.id AND s.organization_id = ?
     ORDER BY o.sort_order`,
  ).all(homeOrg(actor)) as Array<Record<string, unknown>>;
  const selected = findingId ? findingChain(db, mustFinding(db, findingId, actor)) : null;
  const labels: SuppliedRecord[] = [
    ...findings.map((finding) => ({ id: finding.id, label: finding.originalText })),
    ...exposures.map((group) => ({ id: String(group.id), label: `${group.agent} at ${group.shop}` })),
    ...practice.map((row) => ({ id: String(row.id), label: String(row.id) })),
  ];
  if (selected) {
    for (const hazard of selected.hazards) labels.push({ id: String(hazard.id), label: String(hazard.description) });
    for (const action of selected.actions) labels.push({ id: String(action.id), label: String(action.description) });
  }
  const recordIds = [...new Set(labels.map((label) => label.id))];
  return {
    records: {
      findings,
      exposureGroups: exposures,
      asohmsPractice: practice.map((row) => ({
        code: row.id,
        practiceStatus: row.practice_status ?? "not started",
        stageLabel: row.stage_label,
      })),
      selectedFinding: selected,
    },
    recordIds,
    labels,
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
    throw new HttpError(400, "program area is set from the environmental record");
  }
}

const EXPOSURE_FIELDS = ["agent", "shop", "controlMethod", "headcount", "examCompletionPercent"];

function requireExposure(body: Record<string, unknown>): {
  agent: string;
  shop: string;
  controlMethod: string;
  headcount: number;
  examCompletionPercent: number;
} {
  for (const key of Object.keys(body)) {
    if (!EXPOSURE_FIELDS.includes(key)) {
      throw new HttpError(400, `${key} is not stored on an exposure group`);
    }
  }
  const headcount = body.headcount;
  if (typeof headcount !== "number" || !Number.isInteger(headcount) || headcount < 0) {
    throw new HttpError(400, "headcount must be a whole number of people");
  }
  const examCompletionPercent = body.examCompletionPercent;
  if (
    typeof examCompletionPercent !== "number" ||
    !Number.isFinite(examCompletionPercent) ||
    examCompletionPercent < 0 ||
    examCompletionPercent > 100
  ) {
    throw new HttpError(400, "examCompletionPercent must be from 0 to 100");
  }
  return {
    agent: requireString(body, "agent"),
    shop: requireString(body, "shop"),
    controlMethod: requireString(body, "controlMethod"),
    headcount,
    examCompletionPercent,
  };
}

function rejectCompliance(body: Record<string, unknown>): void {
  for (const key of ["compliant", "compliance", "determination", "met", "inCompliance"]) {
    if (key in body) {
      throw new HttpError(400, "SENTINEL does not record a compliance determination");
    }
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

function localDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function findingWorkRows(db: DatabaseSync, ids: string[]): Array<Record<string, unknown>> {
  if (ids.length === 0) {
    return [];
  }
  const placeholders = ids.map(() => "?").join(", ");
  return db.prepare(
    `SELECT f.id, f.organization_id, f.original_text, f.status,
       (SELECT name FROM organization WHERE id = f.organization_id) AS organization_name,
       (SELECT i.shop_name FROM inspection i JOIN observation o ON o.inspection_id = i.id WHERE o.id = f.source_observation_id) AS shop_name,
       (SELECT inspection_id FROM observation WHERE id = f.source_observation_id) AS inspection_id,
       (SELECT COUNT(*) FROM finding_hazard fh WHERE fh.finding_id = f.id) AS hazard_count,
       (SELECT COUNT(*) FROM risk_assessment ra
          JOIN finding_hazard fh ON fh.hazard_id = ra.hazard_id
          WHERE fh.finding_id = f.id AND ra.phase = 'initial') AS initial_count,
       (SELECT COUNT(*) FROM risk_assessment ra
          JOIN finding_hazard fh ON fh.hazard_id = ra.hazard_id
          WHERE fh.finding_id = f.id AND ra.phase = 'residual') AS residual_count,
       (SELECT COUNT(*) FROM control c
          JOIN risk_assessment ra ON ra.id = c.assessment_id
          JOIN finding_hazard fh ON fh.hazard_id = ra.hazard_id
          WHERE fh.finding_id = f.id) AS control_count,
       (SELECT COUNT(*) FROM risk_decision rd
          JOIN risk_assessment ra ON ra.id = rd.assessment_id
          JOIN finding_hazard fh ON fh.hazard_id = ra.hazard_id
          WHERE fh.finding_id = f.id) AS decision_count,
       (SELECT ac.result FROM authority_check ac
          JOIN risk_decision rd ON rd.id = ac.decision_id
          JOIN risk_assessment ra ON ra.id = rd.assessment_id
          JOIN finding_hazard fh ON fh.hazard_id = ra.hazard_id
          WHERE fh.finding_id = f.id
          ORDER BY rd.created_at DESC LIMIT 1) AS authority_result,
       (SELECT id FROM corrective_action WHERE finding_id = f.id ORDER BY created_at DESC LIMIT 1) AS action_id,
       (SELECT status FROM corrective_action WHERE finding_id = f.id ORDER BY created_at DESC LIMIT 1) AS action_status,
       (SELECT description FROM corrective_action WHERE finding_id = f.id ORDER BY created_at DESC LIMIT 1) AS action_description,
       (SELECT owner_user_id FROM corrective_action WHERE finding_id = f.id ORDER BY created_at DESC LIMIT 1) AS action_owner_user_id,
       (SELECT COUNT(*) FROM verification v
          JOIN corrective_action ca ON ca.id = v.action_id
          WHERE ca.finding_id = f.id AND v.result = 'pass') AS passed
     FROM finding f
     WHERE f.organization_id IN (${placeholders})
     ORDER BY f.created_at DESC`,
  ).all(...ids) as Array<Record<string, unknown>>;
}

function publicWorkFinding(row: Record<string, unknown>) {
  return {
    id: row.id,
    originalText: row.original_text,
    status: row.status,
    inspectionId: row.inspection_id,
    authorityResult: row.authority_result,
    actionId: row.action_id,
    actionStatus: row.action_status,
    actionDescription: row.action_description,
    actionOwnerUserId: row.action_owner_user_id,
    organizationName: row.organization_name,
    shopName: row.shop_name,
    step: workStep(row),
  };
}

function overdueInScope(db: DatabaseSync, ids: string[], today: string) {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const rows = db.prepare(
    `SELECT id, finding_id, description, due_on FROM corrective_action
     WHERE organization_id IN (${placeholders}) AND due_on IS NOT NULL AND due_on < ? AND status != 'closed'
     ORDER BY due_on`,
  ).all(...ids, today) as Array<{ id: string; finding_id: string; description: string; due_on: string }>;
  return rows.map((row) => ({
    id: row.id,
    findingId: row.finding_id,
    description: row.description,
    dueOn: row.due_on,
  }));
}

function campCounts(db: DatabaseSync, today: string) {
  const orgs = db.prepare("SELECT id, parent_id, name FROM organization").all() as Array<{
    id: string;
    parent_id: string | null;
    name: string;
  }>;
  const byId = new Map(orgs.map((org) => [org.id, org]));
  const rootName = (id: string) => {
    let current = byId.get(id);
    const seen = new Set<string>();
    while (current?.parent_id && !seen.has(current.id)) {
      seen.add(current.id);
      const parent = byId.get(current.parent_id);
      if (!parent) break;
      current = parent;
    }
    return current?.name ?? "Unknown";
  };
  const steps = ["assess", "decide", "assign", "verify", "close", "done"];
  const buckets = new Map<string, Record<string, number>>();
  for (const org of orgs) {
    if (!org.parent_id) buckets.set(org.name, Object.fromEntries(steps.map((step) => [step, 0])));
  }
  for (const row of findingWorkRows(db, orgs.map((org) => org.id))) {
    const name = rootName(String(row.organization_id));
    const bucket = buckets.get(name) ?? Object.fromEntries(steps.map((step) => [step, 0]));
    const step = String(workStep(row));
    bucket[step] = (bucket[step] ?? 0) + 1;
    buckets.set(name, bucket);
  }
  const late = db.prepare(
    `SELECT organization_id, COUNT(*) AS n FROM corrective_action
     WHERE due_on IS NOT NULL AND due_on < ? AND status != 'closed'
     GROUP BY organization_id`,
  ).all(today) as Array<{ organization_id: string; n: number }>;
  const overdue = new Map<string, number>();
  for (const row of late) {
    const name = rootName(row.organization_id);
    overdue.set(name, (overdue.get(name) ?? 0) + Number(row.n));
  }
  return [...buckets.entries()].map(([name, stepCounts]) => ({
    name,
    steps: stepCounts,
    overdueActions: overdue.get(name) ?? 0,
  }));
}

function tallyStatus(rows: Array<{ status: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}

function orgRows(db: DatabaseSync, table: string, columns: string, ids: string[], orderBy: string): Array<Record<string, unknown>> {
  if (!/^[a-z_]+$/.test(table) || !/^[a-z_, ]+$/.test(columns) || !/^[a-z_]+ DESC$/.test(orderBy) || ids.length === 0) {
    return [];
  }
  const placeholders = ids.map(() => "?").join(", ");
  return db
    .prepare(`SELECT ${columns} FROM ${table} WHERE organization_id IN (${placeholders}) ORDER BY ${orderBy}`)
    .all(...ids) as Array<Record<string, unknown>>;
}

function workStep(row: Record<string, unknown>): string {
  const hazard = Number(row.hazard_count);
  const initial = Number(row.initial_count);
  const residual = Number(row.residual_count);
  const control = Number(row.control_count);
  const decision = Number(row.decision_count);
  const actionStatus = typeof row.action_status === "string" ? row.action_status : null;
  const passed = Number(row.passed);
  if (hazard === 0 || initial === 0 || residual === 0 || control === 0) return "assess";
  if (decision === 0) return "decide";
  if (!actionStatus) return "assign";
  if (actionStatus === "open" || passed === 0) return "verify";
  if (actionStatus !== "closed") return "close";
  return "done";
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
    programArea?: string | null;
  },
): FindingRow {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO finding (
       id, organization_id, original_text, status, source_observation_id, source_report_id, program_area, created_at, created_by
     ) VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.organizationId,
    input.originalText,
    input.sourceObservationId,
    input.sourceReportId,
    input.programArea ?? null,
    now(),
    actor.id,
  );
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
    programArea: row.program_area,
  };
}

function linkedFindings(db: DatabaseSync, table: string, column: string, id: string): ReturnType<typeof publicFinding>[] {
  if (!/^[a-z_]+$/.test(table) || !/^[a-z_]+$/.test(column)) {
    throw new HttpError(500, "server error");
  }
  const rows = db
    .prepare(
      `SELECT finding.* FROM finding
       JOIN ${table} link ON link.finding_id = finding.id
       WHERE link.${column} = ?
       ORDER BY finding.created_at`,
    )
    .all(id) as FindingRow[];
  return rows.map(publicFinding);
}

function publicObligation(row: Record<string, unknown>) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    applicabilityText: row.applicability_text,
    programArea: row.program_area,
  };
}

function publicWaste(row: Record<string, unknown>) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    obligationId: row.obligation_id,
    name: row.name,
    wasteKind: row.waste_kind,
  };
}

function spillSteps(db: DatabaseSync, spillId: string) {
  return (
    db.prepare("SELECT id, step, note FROM spill_response WHERE spill_id = ? ORDER BY created_at").all(spillId) as Array<{
      id: string;
      step: string;
      note: string;
    }>
  ).map((row) => ({ id: row.id, step: row.step, note: row.note }));
}

function publicMishap(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    occurredOn: String(row.occurred_on),
    narrative: String(row.narrative),
    personnelCategory: String(row.personnel_category),
    outcome: String(row.outcome),
  };
}

function mishapClock(personnelCategory: string, outcome: string): string | null {
  const civilianInjury = personnelCategory === "DA civilian" && (outcome === "injury reported" || outcome === "occupational illness reported");
  return civilianInjury
    ? "For a DA civilian injury or illness, DA Pam 385-40 appendix H points notification at 29 CFR 1904.39. The safety officer makes that notice outside SENTINEL."
    : null;
}

function publicTraining(row: Record<string, unknown>) {
  const topic = String(row.topic);
  return {
    id: String(row.id),
    topic,
    audience: String(row.audience),
    dueOn: String(row.due_on),
    completedOn: row.completed_on == null ? null : String(row.completed_on),
    headcount: Number(row.headcount),
    basis: TRAINING_TOPICS[topic as keyof typeof TRAINING_TOPICS] ?? "Training topic is not on the Army list used here.",
  };
}

function publicFire(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    kind: String(row.kind),
    place: String(row.place),
    occurredOn: String(row.occurred_on),
    purpose: String(row.purpose),
    note: String(row.note),
  };
}

function rejectMishapExtras(body: Record<string, unknown>): void {
  rejectCompliance(body);
  for (const key of ["class", "mishapClass", "diagnosis", "patient", "name", "medical", "oshaRate", "daysAway", "cost", "log"]) {
    if (key in body) throw new HttpError(400, "a mishap here has no class, no name, no diagnosis, and no OSHA rate");
  }
}

function rejectTrainingExtras(body: Record<string, unknown>): void {
  rejectCompliance(body);
  for (const key of ["certified", "qualified", "license", "credential"]) {
    if (key in body) throw new HttpError(400, "a training headcount is not a qualification");
  }
}

function rejectFireExtras(body: Record<string, unknown>): void {
  rejectCompliance(body);
  for (const key of ["ignition", "fuelMoisture", "prescription", "weather"]) {
    if (key in body) throw new HttpError(400, "an ignition plan is not stored");
  }
}

function requireDate(body: Record<string, unknown>, key: string): string {
  const value = requireString(body, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, `${key} must be a date`);
  return value;
}

function publicMaterial(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    storagePlace: String(row.storage_place),
    sheetPlace: String(row.sheet_place),
  };
}

function materialInHome(db: DatabaseSync, actor: Actor, value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new HttpError(400, "materialId must name a material in this place");
  const material = mustGet(db, "hazardous_material", value, actor);
  if (material.organization_id !== homeOrg(actor)) {
    throw new HttpError(400, "the material has to be kept at the place filing the spill");
  }
  return material.id;
}

function rejectMaterialExtras(body: Record<string, unknown>): void {
  rejectCompliance(body);
  for (const key of ["sheetText", "composition", "ingredients", "firstAid", "cleanup", "recipe"]) {
    if (key in body) throw new HttpError(400, "the safety data sheet text is not stored");
  }
}

function publicSpill(db: DatabaseSync, row: Record<string, unknown>) {
  const material = row.material_id == null
    ? undefined
    : (db.prepare("SELECT name, storage_place, sheet_place FROM hazardous_material WHERE id = ?").get(String(row.material_id)) as { name: string; storage_place: string; sheet_place: string } | undefined);
  return {
    id: row.id,
    organizationId: row.organization_id,
    description: row.description,
    reportedTo: row.reported_to,
    materialId: row.material_id == null ? null : String(row.material_id),
    materialName: material?.name ?? null,
    storagePlace: material?.storage_place ?? null,
    sheetPlace: material?.sheet_place ?? null,
  };
}

function publicExposure(row: Record<string, unknown>) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    agent: row.agent,
    shop: row.shop,
    controlMethod: row.control_method,
    headcount: row.headcount,
    examCompletionPercent: row.exam_completion_percent,
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
  const evidence = actionIds.length
    ? db
        .prepare(
          `SELECT * FROM evidence WHERE action_id IN (${actionIds.map(() => "?").join(", ")}) ORDER BY uploaded_at`,
        )
        .all(...actionIds)
    : [];
  return {
    finding: publicFinding(finding),
    hazards: (hazards as Record<string, unknown>[]).map(publicHazard),
    assessments: (assessments as Record<string, unknown>[]).map(publicAssessment),
    controls: (controls as Record<string, unknown>[]).map(publicControl),
    decisions: (decisions as Record<string, unknown>[]).map(publicDecision),
    authorityChecks: (authorityChecks as Record<string, unknown>[]).map(publicAuthority),
    actions: (actions as Record<string, unknown>[]).map(publicAction),
    evidence: (evidence as Record<string, unknown>[]).map(publicEvidence),
    verifications: (verifications as Record<string, unknown>[]).map(publicVerification),
    authorizations: (
      db.prepare(
        `SELECT w.id, w.task_name, w.note, u.display_name AS authorized_by, w.created_at
         FROM work_authorization w JOIN user u ON u.id = w.authorized_by
         WHERE w.finding_id = ? ORDER BY w.created_at`,
      ).all(finding.id) as Array<{
        id: string;
        task_name: string;
        note: string;
        authorized_by: string;
        created_at: string;
      }>
    ).map((row) => ({
      id: row.id,
      taskName: row.task_name,
      note: row.note,
      authorizedBy: row.authorized_by,
      createdAt: row.created_at,
    })),
  };
}

function roleNames(db: DatabaseSync, userId: string): string[] {
  const rows = db
    .prepare(
      `SELECT r.name AS role FROM user_role ur JOIN role r ON r.id = ur.role_id WHERE ur.user_id = ?`,
    )
    .all(userId) as Array<{ role: string }>;
  return rows.map((row) => row.role);
}

function publicInspection(row: Record<string, unknown>) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    shopName: row.shop_name,
    inspectedOn: row.inspected_on,
    inspectorUserId: row.inspector_user_id,
    status: row.status,
  };
}

function publicObservation(row: Record<string, unknown>) {
  return {
    id: row.id,
    inspectionId: row.inspection_id,
    text: row.text,
  };
}

function publicHazard(row: Record<string, unknown>) {
  return {
    id: row.id,
    description: row.description,
  };
}

function publicControl(row: Record<string, unknown>) {
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    atpCategory: row.atp_category,
    hierarchyStep: row.hierarchy_step,
    whatText: row.what_text,
    whoText: row.who_text,
    howText: row.how_text,
  };
}

function publicAction(row: Record<string, unknown>) {
  return {
    id: row.id,
    findingId: row.finding_id,
    hazardId: row.hazard_id,
    description: row.description,
    ownerUserId: row.owner_user_id,
    dueOn: row.due_on,
    status: row.status,
    kind: row.kind,
    completedBy: row.completed_by,
  };
}

function publicEvidence(row: Record<string, unknown>) {
  return {
    id: row.id,
    actionId: row.action_id,
    fileName: row.file_name,
    contentHash: row.content_hash,
    uploadedBy: row.uploaded_by,
  };
}

function publicVerification(row: Record<string, unknown>) {
  return {
    id: row.id,
    actionId: row.action_id,
    result: row.result,
    notes: row.notes,
    verifierUserId: row.verifier_user_id,
  };
}
