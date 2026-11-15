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

  app.get("/spills", wrap((req, res) => {
    const actor = requireActor(db, req);
    res.json({ spills: listScoped(db, actor, "spill", "created_at DESC").map(publicSpill) });
  }));

  app.post("/spills", wrap((req, res) => {
    const actor = requireActor(db, req);
    requireRole(actor, "safety officer");
    const body = bodyOf(req);
    rejectCompliance(body);
    if ("mishapId" in body && body.mishapId !== null) {
      throw new HttpError(400, "mishap records are not in this build");
    }
    const id = randomUUID();
    db.prepare(
      `INSERT INTO spill (id, organization_id, description, reported_to, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, homeOrg(actor), requireString(body, "description"), requireString(body, "reportedTo"), now(), actor.id);
    res.status(201).json(publicSpill(getOne(db, "spill", id)));
  }));

  app.get("/spills/:id", wrap((req, res) => {
    const actor = requireActor(db, req);
    const spill = mustGet(db, "spill", routeId(req.params.id), actor);
    res.json({ spill: publicSpill(spill), findings: linkedFindings(db, "spill_finding", "spill_id", spill.id) });
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
    res.json({
      asOf: today,
      findings: countByStatus(db, "finding", ids),
      actions: countByStatus(db, "corrective_action", ids),
      inspections: countByStatus(db, "inspection", ids),
      overdueActions: overdueActions(db, ids, today),
      exposureGroups: exposureTotals(db, ids),
      obligations: countRows(db, "obligation", ids),
      wasteStreams: countRows(db, "waste_stream", ids),
      spills: countRows(db, "spill", ids),
      notStored: [
        { item: "ASOHMS implementation status", reason: "Official criteria are not loaded." },
        { item: "Training completion", reason: "Training records are not in SENTINEL." },
        { item: "Mishap summaries", reason: "Mishap class is not transcribed from DA Pam 385-40." },
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

function orgFilter(ids: string[]): string {
  return `organization_id IN (${ids.map(() => "?").join(", ")})`;
}

function countByStatus(db: DatabaseSync, table: string, ids: string[]): Record<string, number> {
  if (!/^[a-z_]+$/.test(table) || ids.length === 0) {
    return {};
  }
  const rows = db
    .prepare(`SELECT status, COUNT(*) AS n FROM ${table} WHERE ${orgFilter(ids)} GROUP BY status`)
    .all(...ids) as Array<{ status: string; n: number }>;
  return Object.fromEntries(rows.map((row) => [row.status, row.n]));
}

function countRows(db: DatabaseSync, table: string, ids: string[]): number {
  if (!/^[a-z_]+$/.test(table) || ids.length === 0) {
    return 0;
  }
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${orgFilter(ids)}`).get(...ids) as { n: number };
  return row.n;
}

function exposureTotals(db: DatabaseSync, ids: string[]): { groups: number; people: number } {
  if (ids.length === 0) {
    return { groups: 0, people: 0 };
  }
  const row = db
    .prepare(
      `SELECT COUNT(*) AS groups, COALESCE(SUM(headcount), 0) AS people FROM exposure_group WHERE ${orgFilter(ids)}`,
    )
    .get(...ids) as { groups: number; people: number };
  return row;
}

function overdueActions(db: DatabaseSync, ids: string[], today: string) {
  if (ids.length === 0) {
    return [];
  }
  const rows = db
    .prepare(
      `SELECT id, description, due_on, status FROM corrective_action
       WHERE ${orgFilter(ids)} AND due_on IS NOT NULL AND due_on < ? AND status != 'closed'
       ORDER BY due_on`,
    )
    .all(...ids, today) as Array<{ id: string; description: string; due_on: string; status: string }>;
  return rows.map((row) => ({
    id: row.id,
    description: row.description,
    dueOn: row.due_on,
    status: row.status,
  }));
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

function publicSpill(row: Record<string, unknown>) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    description: row.description,
    reportedTo: row.reported_to,
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
