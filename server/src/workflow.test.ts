import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import type { Express } from "express";
import { PROBABILITY_CODES, SEVERITY_CODES } from "../../shared/src/index.ts";
import { checkReply } from "./ai.ts";
import { createApp } from "./app.ts";
import { SOURCE_CARDS } from "./sources.ts";
import { DEMO_PASSWORD } from "./db.ts";
import { ACCEPTANCE_CELLS, MATRIX_CELLS, lookupAcceptance, lookupMatrix } from "./doctrine.ts";
import { hashPassword } from "./passwords.ts";

const EXPECTED = new Map<string, { level: string; ref: string }>([
  ["IA", { level: "extremely high", ref: "ATP 5-19 paragraph 1-45" }],
  ["IB", { level: "extremely high", ref: "ATP 5-19 paragraph 1-45" }],
  ["IIA", { level: "extremely high", ref: "ATP 5-19 paragraph 1-45" }],
  ["IC", { level: "high", ref: "ATP 5-19 paragraph 1-46" }],
  ["ID", { level: "high", ref: "ATP 5-19 paragraph 1-46" }],
  ["IIB", { level: "high", ref: "ATP 5-19 paragraph 1-46" }],
  ["IIC", { level: "high", ref: "ATP 5-19 paragraph 1-46" }],
  ["IIIA", { level: "high", ref: "ATP 5-19 paragraph 1-46" }],
  ["IE", { level: "medium", ref: "ATP 5-19 paragraph 1-47" }],
  ["IID", { level: "medium", ref: "ATP 5-19 paragraph 1-47" }],
  ["IIIB", { level: "medium", ref: "ATP 5-19 paragraph 1-47" }],
  ["IIIC", { level: "medium", ref: "ATP 5-19 paragraph 1-47" }],
  ["IVA", { level: "medium", ref: "ATP 5-19 paragraph 1-47" }],
  ["IIE", { level: "low", ref: "ATP 5-19 paragraph 1-48" }],
  ["IIID", { level: "low", ref: "ATP 5-19 paragraph 1-48" }],
  ["IIIE", { level: "low", ref: "ATP 5-19 paragraph 1-48" }],
  ["IVB", { level: "low", ref: "ATP 5-19 paragraph 1-48" }],
  ["IVC", { level: "low", ref: "ATP 5-19 paragraph 1-48" }],
  ["IVD", { level: "low", ref: "ATP 5-19 paragraph 1-48" }],
  ["IVE", { level: "low", ref: "ATP 5-19 paragraph 1-48" }],
]);

describe("ATP 5-19 matrix", () => {
  it("has twenty cells and each probability and severity pair once", () => {
    assert.equal(MATRIX_CELLS.length, 20);
    const pairs = MATRIX_CELLS.map((cell) => `${cell.severityCode}${cell.probabilityCode}`);
    assert.equal(new Set(pairs).size, 20);
    for (const severity of SEVERITY_CODES) {
      for (const probability of PROBABILITY_CODES) {
        const cell = lookupMatrix(MATRIX_CELLS, probability, severity);
        const expected = EXPECTED.get(cell.matrixCell);
        assert.ok(expected);
        assert.equal(cell.matrixLevel, expected.level);
        assert.equal(cell.doctrineRef, expected.ref);
      }
    }
  });

  it("paragraph 1-45 is only IA, IB, and IIA", () => {
    const cells = MATRIX_CELLS.filter((cell) => cell.doctrineRef.endsWith("1-45")).map((cell) => cell.matrixCell);
    assert.deepEqual(cells.sort(), ["IA", "IB", "IIA"]);
  });

  it("does not derive a level from an exposure count", () => {
    const cell = lookupMatrix(MATRIX_CELLS, "E", "IV");
    assert.equal(cell.matrixCell, "IVE");
    assert.equal(cell.matrixLevel, "low");
  });
});

describe("DA Pam 385-30 authority", () => {
  it("blocks a medium residual because that row is not verified", () => {
    const result = lookupAcceptance(ACCEPTANCE_CELLS, {
      matrixLevel: "medium",
      durationText: "one month or less",
      publicExposed: false,
      gradeText: "O-6",
    });
    assert.deepEqual(result, { result: "blocked", basis: "authority cell not verified" });
  });

  it("allows an O-6 to accept high risk for one month or less", () => {
    const result = lookupAcceptance(ACCEPTANCE_CELLS, {
      matrixLevel: "high",
      durationText: "one month or less",
      publicExposed: false,
      gradeText: "O-6",
    });
    assert.equal(result.result, "allowed");
    assert.equal(result.basis, "table-4-1-high-one-month-or-less");
  });

  it("blocks an O-6 from accepting high risk beyond one month", () => {
    const result = lookupAcceptance(ACCEPTANCE_CELLS, {
      matrixLevel: "high",
      durationText: "beyond one month",
      publicExposed: false,
      gradeText: "O-6",
    });
    assert.equal(result.result, "blocked");
    assert.equal(result.basis, "table-4-1-note-3");
  });

  it("paragraph 4-4f(2) sends public high risk to the Army headquarters commanding general", () => {
    const allowed = lookupAcceptance(ACCEPTANCE_CELLS, {
      matrixLevel: "high",
      durationText: "one month or less",
      publicExposed: true,
      gradeText: "Army headquarters commanding general",
    });
    const blocked = lookupAcceptance(ACCEPTANCE_CELLS, {
      matrixLevel: "extremely high",
      durationText: "one month or less",
      publicExposed: true,
      gradeText: "general officer",
    });
    assert.equal(allowed.result, "allowed");
    assert.equal(allowed.basis, "paragraph-4-4f-2");
    assert.equal(blocked.result, "blocked");
    assert.equal(blocked.basis, "paragraph-4-4f-2");
  });
});

describe("Shop 2 workflow", () => {
  let server: Server;
  let base: string;
  let dbPath: string;
  let db: ReturnType<typeof createApp>["db"];

  before(async () => {
    dbPath = join(mkdtempSync(join(tmpdir(), "sentinel-")), "test.db");
    const created = createApp(dbPath);
    db = created.db;
    const listening = await listen(created.app);
    server = listening.server;
    base = listening.base;
  });

  after(async () => {
    db.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("walks the unlabeled container from inspection through close", async () => {
    const safety = await login("shop2.safety@camp-sentinel.example");
    const commander = await login("shop2.commander@camp-sentinel.example");
    const supervisor = await login("shop2.supervisor@camp-sentinel.example");
    const otherUnit = await login("unit2.safety@camp-sentinel.example");
    const supervisorId = (
      db.prepare("SELECT id FROM user WHERE email = ?").get("shop2.supervisor@camp-sentinel.example") as {
        id: string;
      }
    ).id;

    const people = await api(safety, "GET", "/users");
    assert.equal(
      (people.users as Array<{ displayName: string }>).some((user) => user.displayName.includes("Supervisor")),
      true,
    );

    const inspection = await api(safety, "POST", "/inspections", {
      shopName: "Shop 2",
      inspectedOn: "2026-11-15",
    });
    assert.equal(inspection.shopName, "Shop 2");
    const detail = await api(safety, "GET", `/inspections/${inspection.id}`);
    assert.equal(detail.inspection.shopName, "Shop 2");
    const observation = await api(safety, "POST", `/inspections/${inspection.id}/observations`, {
      text: "Waste container with no label, north wall.",
    });
    const finding = await api(safety, "POST", `/observations/${observation.id}/findings`, {
      originalText: "Unlabeled container in Shop 2, north wall, observed during the quarterly inspection.",
      matrixLevel: "low",
    });
    assert.equal(
      finding.originalText,
      "Unlabeled container in Shop 2, north wall, observed during the quarterly inspection.",
    );
    assert.throws(() => {
      db.prepare("UPDATE finding SET original_text = ? WHERE id = ?").run("rewritten", finding.id);
    });

    const hidden = await api(otherUnit, "GET", "/inspections");
    assert.equal((hidden.inspections as unknown[]).length, 0);
    const missing = await api(otherUnit, "GET", `/findings/${finding.id}`, undefined, 404);
    assert.equal(missing.error, "record not found");

    const hazard = await api(safety, "POST", `/findings/${finding.id}/hazards`, {
      description: "People may handle unknown contents.",
    });
    const initial = await api(safety, "POST", `/hazards/${hazard.id}/assessments`, {
      phase: "initial",
      probabilityCode: "C",
      severityCode: "II",
      matrixLevel: "low",
      exposureCount: 500,
    });
    assert.equal(initial.matrixCell, "IIC");
    assert.equal(initial.matrixLevel, "high");
    assert.equal(initial.doctrineRef, "ATP 5-19 paragraph 1-46");

    const residual = await api(safety, "POST", `/hazards/${hazard.id}/assessments`, {
      phase: "residual",
      probabilityCode: "D",
      severityCode: "III",
    });
    assert.equal(residual.matrixCell, "IIID");
    assert.equal(residual.matrixLevel, "low");
    await api(safety, "POST", `/assessments/${residual.id}/controls`, {
      atpCategory: "physical",
      whatText: "Identify the contents, label or dispose of the container, and tell the shift what the label means.",
      whoText: "Shop 2 supervisor",
      howText: "Before the next shift.",
    });

    const blocked = await api(commander, "POST", `/assessments/${residual.id}/decisions`, {
      decision: "accept",
      durationText: "one month or less",
      publicExposed: false,
      gradeText: "general officer",
    });
    assert.equal(blocked.decision.decision, "accept");
    assert.equal(blocked.decision.gradeText, "O-5");
    assert.equal(blocked.authorityCheck.result, "blocked");
    assert.equal(blocked.authorityCheck.basis, "authority cell not verified");
    assert.equal(blocked.matrixLevel, "low");

    const columns = db.prepare("PRAGMA table_info(risk_assessment)").all() as Array<{ name: string }>;
    assert.equal(columns.some((column) => column.name === "override"), false);
    await api(
      commander,
      "POST",
      `/assessments/${residual.id}/decisions`,
      { decision: "accept", durationText: "one month or less", publicExposed: false, override: true },
      400,
    );

    const action = await api(safety, "POST", `/findings/${finding.id}/actions`, {
      hazardId: hazard.id,
      description: "Label or dispose of the container.",
      ownerUserId: supervisorId,
      dueOn: "2026-11-16",
      kind: "corrective",
    });
    await api(supervisor, "POST", `/actions/${action.id}/complete`, undefined, 200);
    await api(supervisor, "POST", `/actions/${action.id}/verifications`, { result: "pass", notes: "Label is on." }, 403);
    await api(safety, "POST", `/actions/${action.id}/verifications`, { result: "pass", notes: "Label is on." });
    const closed = await api(safety, "POST", `/actions/${action.id}/close`, undefined, 200);
    assert.equal(closed.finding.originalText, finding.originalText);
    assert.equal(closed.finding.status, "action closed");

    const chain = await api(safety, "GET", `/findings/${finding.id}`);
    assert.equal(chain.hazards.length, 1);
    assert.equal(chain.finding.originalText, finding.originalText);
    assert.equal(chain.authorityChecks[0].result, "blocked");

    const tracked = await api(safety, "GET", "/waste-streams");
    assert.equal(Array.isArray(tracked.wasteStreams), true);
  });

  it("hides a reporter's name and keeps evidence on the assigned action", async () => {
    const employee = await login("shop2.employee@camp-sentinel.example");
    const safety = await login("shop2.safety@camp-sentinel.example");
    const supervisor = await login("shop2.supervisor@camp-sentinel.example");
    const otherUnit = await login("unit2.safety@camp-sentinel.example");
    const supervisorId = (
      db.prepare("SELECT id FROM user WHERE email = ?").get("shop2.supervisor@camp-sentinel.example") as {
        id: string;
      }
    ).id;

    const hidden = await api(employee, "POST", "/employee-reports", {
      text: "The grinder guard is off on the north bench.",
      showName: false,
      reporterDisplayName: "Shop 2 Employee",
    });
    assert.equal(hidden.reporterDisplayName, null);
    assert.equal(hidden.showName, false);
    const stored = db.prepare("SELECT reporter_display_name FROM employee_report WHERE id = ?").get(hidden.id) as {
      reporter_display_name: string | null;
    };
    assert.equal(stored.reporter_display_name, null);

    const listed = await api(safety, "GET", "/employee-reports");
    const shared = (listed.employeeReports as Array<{ id: string; reporterDisplayName: string | null }>).find(
      (report) => report.id === hidden.id,
    );
    assert.equal(shared?.reporterDisplayName, null);
    const other = await api(otherUnit, "GET", "/employee-reports");
    assert.equal(
      (other.employeeReports as Array<{ id: string }>).some((report) => report.id === hidden.id),
      false,
    );

    const finding = await api(safety, "POST", `/employee-reports/${hidden.id}/findings`, {
      originalText: "Grinder guard missing on the north bench.",
    });
    assert.equal(finding.sourceReportId, hidden.id);
    const detail = await api(safety, "GET", `/employee-reports/${hidden.id}`);
    assert.equal(detail.report.reporterDisplayName, null);
    assert.equal(detail.findings[0].originalText, finding.originalText);

    const hazard = await api(safety, "POST", `/findings/${finding.id}/hazards`, {
      description: "A person can meet the wheel.",
    });
    const action = await api(safety, "POST", `/findings/${finding.id}/actions`, {
      hazardId: hazard.id,
      description: "Replace the grinder guard.",
      ownerUserId: supervisorId,
      kind: "corrective",
    });
    const bytes = Buffer.from("guard installed");
    await api(employee, "POST", `/actions/${action.id}/evidence`, {
      fileName: "guard.txt",
      contentBase64: bytes.toString("base64"),
    }, 403);
    const evidence = await api(supervisor, "POST", `/actions/${action.id}/evidence`, {
      fileName: "guard.txt",
      contentBase64: bytes.toString("base64"),
    });
    assert.equal(evidence.fileName, "guard.txt");
    assert.equal(evidence.contentHash, createHash("sha256").update(bytes).digest("hex"));
    const chain = await api(safety, "GET", `/findings/${finding.id}`);
    assert.equal(chain.evidence[0].fileName, "guard.txt");
    assert.equal(chain.evidence[0].contentHash, evidence.contentHash);
    assert.equal(chain.finding.originalText, finding.originalText);
  });

  it("tracks an obligation, a waste stream, and a spill without a compliance determination", async () => {
    const safety = await login("shop2.safety@camp-sentinel.example");
    const otherUnit = await login("unit2.safety@camp-sentinel.example");
    const obligation = await api(safety, "POST", "/obligations", {
      title: "Shop 2 waste label duty",
      applicabilityText: "Camp Sentinel shop operating procedure, issued by the garrison environmental office.",
      programArea: "waste",
    });
    assert.equal(obligation.programArea, "waste");
    assert.equal("compliant" in obligation, false);
    await api(safety, "POST", "/obligations", {
      title: "Bad",
      applicabilityText: "Nowhere",
      programArea: "waste",
      compliant: true,
    }, 400);

    const finding = await api(safety, "POST", `/obligations/${obligation.id}/findings`, {
      originalText: "North-wall container has no waste label.",
    });
    assert.equal(finding.programArea, "waste");
    assert.equal(finding.originalText, "North-wall container has no waste label.");

    const waste = await api(safety, "POST", "/waste-streams", {
      name: "Shop 2 used solvent",
      wasteKind: "subtitle C",
      obligationId: obligation.id,
    });
    assert.equal(waste.wasteKind, "subtitle C");
    const spill = await api(safety, "POST", "/spills", {
      description: "A cup of solvent reached the floor.",
      reportedTo: "Camp Sentinel garrison on-scene coordinator",
    });
    assert.equal(spill.reportedTo, "Camp Sentinel garrison on-scene coordinator");
    await api(safety, "POST", "/spills", {
      description: "Another spill",
      reportedTo: "coordinator",
      mishapId: "not-built",
    }, 400);

    const columns = db.prepare("PRAGMA table_info(obligation)").all() as Array<{ name: string }>;
    assert.equal(columns.some((column) => /compliant|determination/i.test(column.name)), false);

    const hidden = await api(otherUnit, "GET", "/obligations");
    assert.equal(
      (hidden.obligations as Array<{ id: string }>).some((row) => row.id === obligation.id),
      false,
    );
    await api(otherUnit, "GET", `/obligations/${obligation.id}`, undefined, 404);
  });

  it("counts council records the organization holds and leaves the rest unstored", async () => {
    const safety = await login("shop2.safety@camp-sentinel.example");
    const otherUnit = await login("unit2.safety@camp-sentinel.example");
    const supervisorId = (
      db.prepare("SELECT id FROM user WHERE email = ?").get("shop2.supervisor@camp-sentinel.example") as { id: string }
    ).id;
    const inspection = await api(safety, "POST", "/inspections", { shopName: "Shop 2", inspectedOn: "2026-11-15" });
    const observation = await api(safety, "POST", `/inspections/${inspection.id}/observations`, { text: "Council fixture." });
    const finding = await api(safety, "POST", `/observations/${observation.id}/findings`, {
      originalText: "Council fixture finding.",
    });
    const hazard = await api(safety, "POST", `/findings/${finding.id}/hazards`, { description: "Council fixture hazard." });
    const late = await api(safety, "POST", `/findings/${finding.id}/actions`, {
      hazardId: hazard.id,
      description: "Council overdue action.",
      ownerUserId: supervisorId,
      dueOn: "2020-01-01",
      kind: "corrective",
    });
    const future = await api(safety, "POST", `/findings/${finding.id}/actions`, {
      hazardId: hazard.id,
      description: "Council future action.",
      ownerUserId: supervisorId,
      dueOn: "2099-01-01",
      kind: "corrective",
    });

    const council = await api(safety, "GET", "/council");
    assert.equal("oshaRate" in council, false);
    assert.equal("readiness" in council, false);
    assert.equal(
      (council.overdueActions as Array<{ id: string; findingId: string }>).find((action) => action.id === late.id)?.findingId,
      finding.id,
    );
    const held = (council.records as { findings: Array<{ id: string; status: string }> }).findings;
    const heldFinding = held.find((row) => row.id === finding.id);
    assert.ok(heldFinding);
    assert.equal(
      held.filter((row) => row.status === heldFinding.status).length,
      (council.findings as Record<string, number>)[heldFinding.status],
    );
    assert.equal(
      (council.overdueActions as Array<{ id: string }>).some((action) => action.id === future.id),
      false,
    );
    const absent = (council.notStored as Array<{ item: string }>).map((item) => item.item);
    assert.ok(absent.includes("OSHA rates"));
    assert.ok(absent.includes("Mishap summaries"));
    assert.ok(absent.includes("ASOHMS implementation status"));

    const other = await api(otherUnit, "GET", "/council");
    assert.equal(
      (other.overdueActions as Array<{ id: string }>).some((action) => action.id === late.id),
      false,
    );
  });

  it("stores an exposure group as counts and rejects a diagnosis", async () => {
    const safety = await login("shop2.safety@camp-sentinel.example");
    const otherUnit = await login("unit2.safety@camp-sentinel.example");
    const group = await api(safety, "POST", "/exposure-groups", {
      agent: "solvent vapor",
      shop: "Shop 2",
      controlMethod: "local exhaust",
      headcount: 4,
      examCompletionPercent: 75,
    });
    assert.equal(group.headcount, 4);
    assert.equal(group.examCompletionPercent, 75);
    assert.equal("diagnosis" in group, false);
    await api(safety, "POST", "/exposure-groups", {
      agent: "noise",
      shop: "Shop 2",
      controlMethod: "hearing protection",
      headcount: 4,
      examCompletionPercent: 75,
      diagnosis: "hearing loss",
    }, 400);
    const columns = db.prepare("PRAGMA table_info(exposure_group)").all() as Array<{ name: string }>;
    assert.equal(columns.some((column) => /person|diagnosis|patient|result/i.test(column.name)), false);
    const hidden = await api(otherUnit, "GET", "/exposure-groups");
    assert.equal(
      (hidden.exposureGroups as Array<{ id: string }>).some((row) => row.id === group.id),
      false,
    );
  });

  it("stores a local ASOHMS practice note and refuses an official assessment", async () => {
    const safety = await login("shop2.safety@camp-sentinel.example");
    const otherUnit = await login("unit2.safety@camp-sentinel.example");
    const page = await api(safety, "GET", "/asohms");
    const codes = (page.objectives as Array<{ code: string; officialText: string | null; placeholderNote: string }>).map(
      (row) => row.code,
    );
    assert.deepEqual(codes, ["CO-LEAD", "CO-MISHAP", "CO-TRAIN", "CO-INSPECT", "CO-HAZARD", "CO-HEALTH"]);
    for (const row of page.objectives as Array<{ officialText: string | null; placeholderNote: string }>) {
      assert.equal(row.officialText, null);
      assert.match(row.placeholderNote, /Official criterion text is not loaded/);
    }
    assert.match(String(page.notice), /does not produce an official Army assessment/);

    const saved = await api(safety, "PUT", "/asohms/CO-INSPECT/practice", {
      practiceStatus: "in progress",
      stageLabel: "documentation",
    });
    assert.equal(saved.practiceStatus, "in progress");
    assert.equal(saved.stageLabel, "documentation");
    const again = await api(safety, "GET", "/asohms");
    const inspect = (again.objectives as Array<{ code: string; practiceStatus: string }>).find(
      (row) => row.code === "CO-INSPECT",
    );
    assert.equal(inspect?.practiceStatus, "in progress");

    const other = await api(otherUnit, "GET", "/asohms");
    const hidden = (other.objectives as Array<{ code: string; practiceStatus: string }>).find(
      (row) => row.code === "CO-INSPECT",
    );
    assert.equal(hidden?.practiceStatus, "not started");

    await api(safety, "PUT", "/asohms/CO-LEAD/practice", {
      practiceStatus: "complete",
      star: true,
    }, 400);
    const columns = db.prepare("PRAGMA table_info(asohms_score)").all() as Array<{ name: string }>;
    assert.equal(columns.some((column) => column.name === "is_official_assessment"), false);
  });

  it("names the next step for this organization", async () => {
    const safety = await login("shop2.safety@camp-sentinel.example");
    const otherUnit = await login("unit2.safety@camp-sentinel.example");
    const inspection = await api(safety, "POST", "/inspections", { shopName: "Shop 2", inspectedOn: "2026-11-15" });
    const observation = await api(safety, "POST", `/inspections/${inspection.id}/observations`, { text: "North wall." });
    const finding = await api(safety, "POST", `/observations/${observation.id}/findings`, {
      originalText: "Unlabeled container in Shop 2, north wall.",
    });
    const work = await api(safety, "GET", "/work");
    const row = (work.findings as Array<{ id: string; step: string }>).find((item) => item.id === finding.id);
    assert.equal(row?.step, "assess");
    const hidden = await api(otherUnit, "GET", "/work");
    assert.equal((hidden.findings as Array<{ id: string }>).some((item) => item.id === finding.id), false);
  });

  it("keeps each camp on its own records", async () => {
    const garrison = await login("garrison.safety@camp-sentinel.example");
    const harrow = await login("safety@camp-harrow.example");
    const wash = await login("wash.safety@camp-sentinel.example");
    const garrisonWork = await api(garrison, "GET", "/work");
    const harrowWork = await api(harrow, "GET", "/work");
    const washWork = await api(wash, "GET", "/work");
    const texts = (body: Record<string, unknown>) =>
      (body.findings as Array<{ originalText: string }>).map((row) => row.originalText);
    assert.equal(texts(garrisonWork).includes("A vehicle in bay 1 is raised without jack stands."), true);
    assert.equal(texts(garrisonWork).includes("The exit grate is slick with mud and has no grit."), true);
    assert.equal(texts(washWork).includes("A vehicle in bay 1 is raised without jack stands."), false);
    assert.equal(texts(washWork).includes("The exit grate is slick with mud and has no grit."), true);
    assert.equal(texts(harrowWork).some((text) => text.includes("jack stands")), false);
    assert.equal(texts(harrowWork).includes("The water buffalo at range 2 is empty on a training day."), true);
    const finding = (garrisonWork.findings as Array<{ id: string; originalText: string }>).find((row) =>
      row.originalText.includes("jack stands"),
    );
    assert.ok(finding);
    const chain = await api(garrison, "GET", `/findings/${finding.id}`);
    const residual = (chain.assessments as Array<{ phase: string; probabilityCode: string; severityCode: string; matrixLevel: string; matrixCell: string }>).find(
      (row) => row.phase === "residual",
    );
    assert.ok(residual);
    const cell = lookupMatrix(MATRIX_CELLS, residual.probabilityCode, residual.severityCode);
    assert.equal(residual.matrixLevel, cell.matrixLevel);
    assert.equal(residual.matrixCell, cell.matrixCell);
  });

  it("allows a general officer fixture to accept extremely high risk without changing the cell", async () => {
    const hash = hashPassword(DEMO_PASSWORD);
    db.prepare(
      `INSERT INTO user (id, organization_id, email, password_hash, display_name, grade_text, created_at, created_by)
       VALUES ('user-go', 'org-shop-2', 'go@camp-sentinel.example', ?, 'General Officer fixture', 'general officer', ?, NULL)`,
    ).run(hash, new Date().toISOString());
    db.prepare(
      `INSERT INTO user_role (id, user_id, role_id, organization_id, created_at, created_by)
       VALUES ('ur-go', 'user-go', 'commander', 'org-shop-2', ?, NULL)`,
    ).run(new Date().toISOString());

    const safety = await login("shop2.safety@camp-sentinel.example");
    const general = await login("go@camp-sentinel.example");
    const inspection = await api(safety, "POST", "/inspections", {
      shopName: "Shop 2",
      inspectedOn: "2026-11-15",
    });
    const observation = await api(safety, "POST", `/inspections/${inspection.id}/observations`, { text: "Fixture." });
    const finding = await api(safety, "POST", `/observations/${observation.id}/findings`, {
      originalText: "Fixture finding for an allowed extremely high acceptance.",
    });
    const hazard = await api(safety, "POST", `/findings/${finding.id}/hazards`, { description: "Fixture hazard." });
    const residual = await api(safety, "POST", `/hazards/${hazard.id}/assessments`, {
      phase: "residual",
      probabilityCode: "A",
      severityCode: "I",
    });
    assert.equal(residual.matrixCell, "IA");
    const accepted = await api(general, "POST", `/assessments/${residual.id}/decisions`, {
      decision: "accept",
      durationText: "one month or less",
      publicExposed: false,
    });
    assert.equal(accepted.authorityCheck.result, "allowed");
    assert.equal(accepted.authorityCheck.basis, "table-4-1-note-3");
    assert.equal(accepted.matrixLevel, "extremely high");
    assert.equal(accepted.matrixCell, "IA");
  });

  async function login(email: string): Promise<string> {
    const response = await fetch(`${base}/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: DEMO_PASSWORD }),
    });
    assert.equal(response.status, 201);
    const body = (await response.json()) as { token: string };
    return body.token;
  }

  async function api(
    token: string,
    method: string,
    path: string,
    payload?: unknown,
    expected = method === "POST" ? 201 : 200,
  ): Promise<Record<string, any>> {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(payload === undefined ? {} : { "content-type": "application/json" }),
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const body = (await response.json()) as Record<string, any>;
    assert.equal(response.status, expected, JSON.stringify(body));
    return body;
  }
});

describe("explanation call", () => {
  it("keeps supplied citations and marks the rest unverified", () => {
    const checked = checkReply(
      JSON.stringify({
        facts: ["The cell is extremely high.", "29 CFR 1910 requires a label."],
        observations: [],
        assumptions: [],
        recommendations: ["A person decides."],
        recordCitations: ["finding-1", "other-unit-finding"],
        sourceCitations: ["src-atp-5-19-1-45", "src-missing"],
        otherPublications: ["DA Pam 385-16"],
      }),
      [{ id: "finding-1", label: "Unlabeled container" }],
      SOURCE_CARDS,
    );
    assert.deepEqual(checked.recordCitations.map((record) => record.id), ["finding-1"]);
    assert.deepEqual(checked.sourceCitations.map((source) => source.id), ["src-atp-5-19-1-45"]);
    const names = checked.unverified.map((item) => item.name);
    assert.ok(names.includes("other-unit-finding"));
    assert.ok(names.includes("src-missing"));
    assert.ok(names.includes("29 CFR 1910"));
    assert.ok(names.includes("DA Pam 385-16"));
    assert.equal(names.includes("ATP 5-19"), false);
  });

  it("answers from supplied records and does not change the finding", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "sentinel-ai-")), "test.db");
    let prompt = "";
    let cited = "";
    const created = createApp(dbPath, {
      complete: async (value) => {
        prompt = value;
        return JSON.stringify({
          facts: ["The finding is open."],
          observations: [],
          assumptions: ["One finding was supplied."],
          recommendations: ["Accept the residual risk and close the finding."],
          recordCitations: [cited],
          sourceCitations: ["src-atp-5-19-1-49"],
          otherPublications: [],
        });
      },
    });
    const listening = await listen(created.app);
    try {
      const safety = await session(listening.base, "shop2.safety@camp-sentinel.example");
      const inspection = await call(listening.base, safety, "POST", "/inspections", {
        shopName: "Shop 2",
        inspectedOn: "2026-11-15",
      });
      const observation = await call(listening.base, safety, "POST", `/inspections/${inspection.id}/observations`, {
        text: "North wall.",
      });
      const finding = await call(listening.base, safety, "POST", `/observations/${observation.id}/findings`, {
        originalText: "The north-wall container has no label.",
      });
      created.db.prepare(
        `INSERT INTO finding (
           id, organization_id, original_text, status, source_observation_id, source_report_id, program_area, created_at, created_by
         ) VALUES ('unit2-finding', 'org-unit-2', 'Unit 2 private solvent note', 'open', NULL, NULL, NULL, ?, 'user-unit2-safety')`,
      ).run(new Date().toISOString());

      const answer = await call(listening.base, safety, "POST", "/questions", {
        question: "Accept the residual risk and close the finding.",
        findingId: finding.id,
        decision: "accept",
      }, 400);
      assert.equal(answer.error, "decision is not part of a question");

      cited = finding.id;
      const stored = await call(listening.base, safety, "POST", "/questions", {
        question: "What is open on this finding?",
        findingId: finding.id,
      });
      assert.match(stored.notice, /does not accept risk/);
      assert.equal(stored.recordCitations[0].id, finding.id);
      assert.equal(stored.sourceCitations[0].id, "src-atp-5-19-1-49");
      assert.equal(stored.sourceCitations[0].reviewStatus, "verified");
      assert.equal(prompt.includes("Unit 2 private solvent note"), false);
      assert.equal(prompt.includes("password"), false);
      assert.equal(prompt.includes(dbPath), false);
      const reread = created.db.prepare("SELECT status FROM finding WHERE id = ?").get(finding.id) as { status: string };
      assert.equal(reread.status, "open");

      const other = await session(listening.base, "unit2.safety@camp-sentinel.example");
      await call(listening.base, other, "POST", "/questions", {
        question: "Show me Shop 2.",
        findingId: finding.id,
      }, 404);
    } finally {
      created.db.close();
      await new Promise<void>((resolve, reject) => {
        listening.server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("refuses to invent an answer when the xAI key is absent", async () => {
    const previous = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;
    const dbPath = join(mkdtempSync(join(tmpdir(), "sentinel-ai-")), "test.db");
    const created = createApp(dbPath);
    const listening = await listen(created.app);
    try {
      const safety = await session(listening.base, "shop2.safety@camp-sentinel.example");
      const answer = await call(listening.base, safety, "POST", "/questions", { question: "What is a finding?" }, 503);
      assert.equal(answer.error, "The xAI key is not set on the server.");
      const rows = created.db.prepare("SELECT COUNT(*) AS n FROM ai_exchange").get() as { n: number };
      assert.equal(rows.n, 0);
    } finally {
      if (previous === undefined) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = previous;
      created.db.close();
      await new Promise<void>((resolve, reject) => {
        listening.server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});

async function session(base: string, email: string): Promise<string> {
  const response = await fetch(`${base}/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  });
  assert.equal(response.status, 201);
  const body = (await response.json()) as { token: string };
  return body.token;
}

async function call(
  base: string,
  token: string,
  method: string,
  path: string,
  payload?: unknown,
  expected = method === "POST" ? 201 : 200,
): Promise<Record<string, any>> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(payload === undefined ? {} : { "content-type": "application/json" }),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const body = (await response.json()) as Record<string, any>;
  assert.equal(response.status, expected, JSON.stringify(body));
  return body;
}

async function listen(app: Express): Promise<{ server: Server; base: string }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server has no port");
  }
  return { server, base: `http://127.0.0.1:${address.port}` };
}
