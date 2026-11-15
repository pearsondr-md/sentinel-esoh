import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import type { Express } from "express";
import { PROBABILITY_CODES, SEVERITY_CODES } from "../../shared/src/index.ts";
import { createApp } from "./app.ts";
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

    await api(safety, "GET", "/waste-streams", undefined, 404);
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
