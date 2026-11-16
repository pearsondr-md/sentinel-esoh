import type { DatabaseSync } from "node:sqlite";
import { AUDIT_LINES } from "./library.ts";

export const PERSONNEL_CATEGORIES = ["Soldier", "DA civilian", "contractor", "public", "other"] as const;
export const MISHAP_OUTCOMES = [
  "near miss",
  "injury reported",
  "occupational illness reported",
  "property damage",
  "environmental damage",
] as const;
export const TRAINING_TOPICS = {
  "Unit safety officer": "AR 385-10 paragraph 5-5 points unit safety officer training at 29 CFR 1960. This headcount is not an appointment.",
  "Hazard communication": "Shop training on the chemicals already in use. A safety data sheet is not stored.",
  "Spill response": "Who reports a spill and who is called. This record is not a cleanup procedure.",
  "Wildland fire": "AR 200-1 says people who manage wildland fire need the training their work requires. This headcount is not a qualification to burn.",
} as const;
export const FIRE_KINDS = ["wildfire", "prescribed burn", "remediation"] as const;
export const SPILL_STEPS = ["reported", "contained", "cleaned up", "waste held"] as const;

export const MISHAP_NOTICE =
  "DA Pam 385-40 is the mishap procedure. Class is not assigned here, and this record is not sent to the Army Safety Management Information System. It is not a medical record and it is not an OSHA log. Appendix H names 29 CFR 1904.39. SENTINEL does not file that notice and does not compute a rate.";

const NOW = "2026-11-10T16:00:00.000Z";

export function ensureArmyRecords(db: DatabaseSync): void {
  const shop2 = userId(db, "shop2.safety@camp-sentinel.example");
  const wash = userId(db, "wash.safety@camp-sentinel.example");
  const harrow = userId(db, "safety@camp-harrow.example");
  const meridian = userId(db, "safety@camp-meridian.example");
  if (shop2) {
    ensureMaterial(db, "loc-hm-shop2-solvent", "org-shop-2", "Parts-washer solvent", "Parts washer", "Posted on the washer", shop2);
    ensureMaterial(db, "loc-hm-shop2-brake", "org-shop-2", "Brake cleaner", "Bay 3 cabinet", "Posted on the bay 3 cabinet", shop2);
    linkSpillMaterial(db, "loc-spill-shop2-coolant", "loc-hm-shop2-solvent");
    ensureMishap(db, "loc-mishap-shop2", "org-shop-2", "2026-11-12", "A Soldier stepped back as the vehicle lift started.", "Soldier", "near miss", shop2);
    ensureTraining(db, "loc-train-shop2", "org-shop-2", "Hazard communication", "Shop 2", "2026-10-01", null, 8, shop2);
    ensureStep(db, "loc-step-shop2-reported", "org-shop-2", "loc-spill-shop2-coolant", "reported", "Called the garrison environmental office from bay 3.", shop2);
    ensureStep(db, "loc-step-shop2-contained", "org-shop-2", "loc-spill-shop2-coolant", "contained", "Absorbent was put down before the drain.", shop2);
  }
  if (wash) {
    ensureMaterial(db, "loc-hm-wash", "org-wash", "Wash-rack detergent", "Detergent shed", "Posted on the shed door", wash);
    ensureMishap(
      db,
      "loc-mishap-wash",
      "org-wash",
      "2026-11-09",
      "A DA civilian at the wash rack reported an injury after a slip on the wet floor.",
      "DA civilian",
      "injury reported",
      wash,
    );
  }
  if (harrow) {
    ensureMaterial(db, "loc-hm-harrow", "org-harrow", "Diesel", "Range generator", "Posted on the generator tank", harrow);
    ensureFire(db, "loc-fire-harrow", "org-harrow", "wildfire", "Training area 3", "2026-11-04", "Unplanned grass fire.", "Range control called the fire in along the range road.", harrow);
    ensureFire(db, "loc-fire-harrow-repair", "org-harrow", "remediation", "Training area 3", "2026-11-08", "Check the slope after the grass fire.", "The drainage above the road needs a look before the next rain.", harrow);
  }
  if (meridian) {
    ensureMaterial(db, "loc-hm-meridian", "org-meridian", "Diesel", "Fill stand", "Posted at the fill stand", meridian);
    ensureFire(
      db,
      "loc-fire-meridian",
      "org-meridian",
      "prescribed burn",
      "East boundary",
      "2026-11-02",
      "Reduce fuel along the boundary.",
      "The integrated wildland fire plan names who may burn. The burn stayed inside the fuel break.",
      meridian,
    );
    ensureTraining(db, "loc-train-meridian", "org-meridian", "Wildland fire", "Fuel farm and boundary crew", "2026-12-01", "2026-11-01", 4, meridian);
  }
  if (shop2) {
    ensureAudit(db, "loc-audit-shop2", "org-shop-2", "Shop 2 annual look", "2026-11-10", shop2, { train: "not met" });
  }
  if (harrow) {
    ensureAudit(db, "loc-audit-harrow", "org-harrow", "Camp Harrow annual look", "2026-11-09", harrow, {});
  }
  const redwood = userId(db, "safety@camp-redwood.example");
  if (redwood) {
    ensureAudit(db, "loc-audit-redwood", "org-redwood", "Camp Redwood annual look", "2026-11-11", redwood, { health: "not looked at" });
  }
}

function ensureAudit(
  db: DatabaseSync,
  id: string,
  orgId: string,
  title: string,
  auditedOn: string,
  userIdValue: string,
  results: Record<string, string>,
): void {
  if (exists(db, "program_audit", id)) return;
  db.prepare(
    `INSERT INTO program_audit (id, organization_id, title, audited_on, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, orgId, title, auditedOn, NOW, userIdValue);
  for (const line of AUDIT_LINES) {
    const result = results[line.id] ?? "met";
    let findingId: string | null = null;
    if (result === "not met") {
      findingId = `${id}-${line.id}`;
      db.prepare(
        `INSERT INTO finding (
           id, organization_id, original_text, status, source_observation_id, source_report_id, program_area, created_at, created_by
         ) VALUES (?, ?, ?, 'open', NULL, NULL, NULL, ?, ?)`,
      ).run(findingId, orgId, line.text, NOW, userIdValue);
    }
    db.prepare(
      `INSERT INTO program_audit_line (id, organization_id, audit_id, line_text, result, finding_id, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(`${id}-${line.id}`, orgId, id, line.text, result, findingId, NOW, userIdValue);
  }
}

function userId(db: DatabaseSync, email: string): string | null {
  const row = db.prepare("SELECT id FROM user WHERE email = ?").get(email) as { id: string } | undefined;
  return row?.id ?? null;
}

function ensureMaterial(
  db: DatabaseSync,
  id: string,
  orgId: string,
  name: string,
  storagePlace: string,
  sheetPlace: string,
  userIdValue: string,
): void {
  if (exists(db, "hazardous_material", id)) return;
  db.prepare(
    `INSERT INTO hazardous_material (id, organization_id, name, storage_place, sheet_place, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, orgId, name, storagePlace, sheetPlace, NOW, userIdValue);
}

function linkSpillMaterial(db: DatabaseSync, spillId: string, materialId: string): void {
  if (!exists(db, "spill", spillId) || !exists(db, "hazardous_material", materialId)) return;
  db.prepare("UPDATE spill SET material_id = ? WHERE id = ? AND material_id IS NULL").run(materialId, spillId);
}

function ensureMishap(
  db: DatabaseSync,
  id: string,
  orgId: string,
  occurredOn: string,
  narrative: string,
  personnel: string,
  outcome: string,
  userIdValue: string,
): void {
  if (exists(db, "mishap", id)) return;
  db.prepare(
    `INSERT INTO mishap (id, organization_id, occurred_on, narrative, personnel_category, outcome, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, orgId, occurredOn, narrative, personnel, outcome, NOW, userIdValue);
}

function ensureTraining(
  db: DatabaseSync,
  id: string,
  orgId: string,
  topic: string,
  audience: string,
  dueOn: string,
  completedOn: string | null,
  headcount: number,
  userIdValue: string,
): void {
  if (exists(db, "training_session", id)) return;
  db.prepare(
    `INSERT INTO training_session (id, organization_id, topic, audience, due_on, completed_on, headcount, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, orgId, topic, audience, dueOn, completedOn, headcount, NOW, userIdValue);
}

function ensureStep(db: DatabaseSync, id: string, orgId: string, spillId: string, step: string, note: string, userIdValue: string): void {
  if (exists(db, "spill_response", id) || !exists(db, "spill", spillId)) return;
  db.prepare(
    `INSERT INTO spill_response (id, organization_id, spill_id, step, note, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, orgId, spillId, step, note, NOW, userIdValue);
}

function ensureFire(
  db: DatabaseSync,
  id: string,
  orgId: string,
  kind: string,
  place: string,
  occurredOn: string,
  purpose: string,
  note: string,
  userIdValue: string,
): void {
  if (exists(db, "wildland_fire", id)) return;
  db.prepare(
    `INSERT INTO wildland_fire (id, organization_id, kind, place, occurred_on, purpose, note, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, orgId, kind, place, occurredOn, purpose, note, NOW, userIdValue);
}

function exists(db: DatabaseSync, table: string, id: string): boolean {
  const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id) as { id: string } | undefined;
  return row != null;
}
