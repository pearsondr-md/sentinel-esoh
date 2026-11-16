import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { DurationText, MatrixLevel, ProbabilityCode, SeverityCode } from "../../shared/src/index.ts";
import { ACCEPTANCE_CELLS, MATRIX_CELLS, lookupAcceptance, lookupMatrix } from "./doctrine.ts";

const NOW = "2026-11-10T15:00:00.000Z";

type Crew = {
  orgId: string;
  parentId: string | null;
  orgName: string;
  slug: string;
  place: string;
};

type Depth = "hazard" | "initial" | "control" | "decision" | "open" | "completed" | "closed";

type Story = {
  id: string;
  orgId: string;
  shopName: string;
  safetyId: string;
  commanderId: string;
  supervisorId: string;
  employeeId: string;
  commanderGrade: string;
  inspectedOn: string;
  observation: string;
  finding: string;
  hazard: string;
  initial: [ProbabilityCode, SeverityCode];
  residual: [ProbabilityCode, SeverityCode];
  control: [string, string, string];
  duration: DurationText;
  action: string;
  dueOn: string;
  depth: Depth;
  programArea?: string;
};

export function ensureLocations(db: DatabaseSync, passwordHash: string): void {
  ensureOrg(db, "org-wash", "org-camp", "Vehicle wash rack");
  ensureOrg(db, "org-dining", "org-camp", "Dining facility");
  ensureOrg(db, "org-harrow", null, "Camp Harrow");
  ensureOrg(db, "org-meridian", null, "Camp Meridian");

  const crews: Crew[] = [
    { orgId: "org-camp", parentId: null, orgName: "Camp Sentinel", slug: "garrison", place: "Camp Sentinel" },
    { orgId: "org-wash", parentId: "org-camp", orgName: "Vehicle wash rack", slug: "wash", place: "Camp Sentinel" },
    { orgId: "org-dining", parentId: "org-camp", orgName: "Dining facility", slug: "dining", place: "Camp Sentinel" },
    { orgId: "org-harrow", parentId: null, orgName: "Camp Harrow", slug: "harrow", place: "Camp Harrow" },
    { orgId: "org-meridian", parentId: null, orgName: "Camp Meridian", slug: "meridian", place: "Camp Meridian" },
  ];
  for (const crew of crews) {
    ensureCrew(db, crew, passwordHash);
  }

  const shop2 = {
    safetyId: "user-shop2-safety",
    commanderId: "user-shop2-commander",
    supervisorId: "user-shop2-supervisor",
    employeeId: "user-shop2-employee",
  };
  ensureEmptyInspection(db, "loc-insp-shop2-tools", "org-shop-2", "Shop 2 tool room", "2026-11-12", shop2.safetyId);
  for (const story of shop2Stories(shop2)) {
    ensureStory(db, story);
  }
  ensureReport(db, "loc-rep-shop2-sling", "org-shop-2", "The sling on the bay 2 hoist looks frayed.", null, false, shop2.employeeId);
  ensureReport(db, "loc-rep-shop2-coolant", "org-shop-2", "Coolant spilled by bay 3. It was wiped up and not written down.", "Shop 2 Supervisor", true, shop2.supervisorId);
  ensureObligation(db, "loc-ob-shop2-oil", "org-shop-2", "Used oil from the motor pool", "Shop 2 operating procedure, issued by the Camp Sentinel environmental office.", "waste", shop2.safetyId);
  ensureWaste(db, "loc-waste-shop2-oil", "org-shop-2", "loc-ob-shop2-oil", "Used oil", "subtitle C", shop2.safetyId);
  ensureSpill(db, "loc-spill-shop2-coolant", "org-shop-2", "Coolant reached the floor drain in bay 3.", "Camp Sentinel garrison environmental office", shop2.safetyId);
  ensureExposure(db, "loc-exp-shop2-brake", "org-shop-2", "brake dust", "Shop 2", "local exhaust", 6, 80, shop2.safetyId);

  const wash = ids("wash");
  ensureEmptyInspection(db, "loc-insp-wash-drain", "org-wash", "Wash rack storm drain", "2026-11-13", wash.safetyId);
  for (const story of washStories(wash)) ensureStory(db, story);
  ensureExposure(db, "loc-exp-wash", "org-wash", "detergent mist", "Vehicle wash rack", "spray containment", 3, 100, wash.safetyId);
  ensureWaste(db, "loc-waste-wash", "org-wash", null, "Wash-rack sludge", "other", wash.safetyId);
  ensureSpill(db, "loc-spill-wash", "org-wash", "A sheen was seen at the wash-rack outfall.", "Camp Sentinel garrison environmental office", wash.safetyId);

  const dining = ids("dining");
  for (const story of diningStories(dining)) ensureStory(db, story);
  ensureReport(db, "loc-rep-dining", "org-dining", "The floor by the salad bar is slick after lunch.", null, false, dining.employeeId);
  ensureObligation(db, "loc-ob-dining", "org-dining", "Grease-trap pump", "Dining facility operating procedure, issued by the Camp Sentinel environmental office.", "water", dining.safetyId);
  ensureExposure(db, "loc-exp-dining", "org-dining", "heat in the dish room", "Dining facility", "work-rest schedule", 8, 90, dining.safetyId);

  const harrow = ids("harrow");
  for (const story of harrowStories(harrow)) ensureStory(db, story);
  ensureSpill(db, "loc-spill-harrow", "org-harrow", "Diesel on the pad beside the range generator.", "Camp Harrow range control", harrow.safetyId);
  ensureObligation(db, "loc-ob-harrow", "org-harrow", "Generator fuel tank", "Camp Harrow operating procedure for the range generator tank.", "tanks and spills", harrow.safetyId);
  ensureExposure(db, "loc-exp-harrow", "org-harrow", "generator noise", "Range support", "hearing protection", 4, 75, harrow.safetyId);

  const meridian = ids("meridian");
  ensureEmptyInspection(db, "loc-insp-meridian-walk", "org-meridian", "Fuel farm tank walk", "2026-11-14", meridian.safetyId);
  for (const story of meridianStories(meridian)) ensureStory(db, story);
  ensureReport(db, "loc-rep-meridian", "org-meridian", "The seal on the transfer hose is weeping.", "Camp Meridian Employee", true, meridian.employeeId);
  ensureObligation(db, "loc-ob-meridian", "org-meridian", "Aboveground tank inspection", "Camp Meridian operating procedure for the fuel-farm tanks.", "tanks and spills", meridian.safetyId);
  ensureWaste(db, "loc-waste-meridian", "org-meridian", "loc-ob-meridian", "Off-spec diesel", "subtitle C", meridian.safetyId);
  ensureSpill(db, "loc-spill-meridian", "org-meridian", "About five gallons of diesel were contained at the fill stand.", "Camp Meridian fire desk", meridian.safetyId);
  ensureExposure(db, "loc-exp-meridian", "org-meridian", "diesel vapor", "Fuel farm", "ventilation", 5, 80, meridian.safetyId);

  ensurePractice(db, "org-camp", "user-garrison-safety", "CO-INSPECT", "in progress", "Quarterly shop walks are on the calendar.");
  ensurePractice(db, "org-harrow", harrow.safetyId, "CO-HAZARD", "in progress", "Range and water-point hazards are being written down.");
  ensurePractice(db, "org-meridian", meridian.safetyId, "CO-INSPECT", "not started", "Fuel-farm walks have started. The practice note is local.");
}

function ids(slug: string) {
  return {
    safetyId: `user-${slug}-safety`,
    commanderId: `user-${slug}-commander`,
    supervisorId: `user-${slug}-supervisor`,
    employeeId: `user-${slug}-employee`,
  };
}

function shop2Stories(who: ReturnType<typeof ids>): Story[] {
  const base = { orgId: "org-shop-2", shopName: "Shop 2", commanderGrade: "O-5", ...who };
  return [
    story(base, "solvent", "2026-11-08", "Parts washer bay.", "The parts-washer solvent container has no label.", "Unlabeled solvent.", ["C", "II"], ["D", "III"], ["Label the container.", "Shop 2 supervisor", "Attach the waste label before the next shift."], "one month or less", "Label the solvent container.", "2026-11-20", "hazard"),
    story(base, "jacks", "2026-11-08", "Bay 1, vehicle on stands.", "A vehicle in bay 1 is raised without jack stands.", "Vehicle supported only by a jack.", ["C", "II"], ["D", "II"], ["Set jack stands before anyone works under the vehicle.", "Shop 2 supervisor", "Stands go in before the wheels come off."], "one month or less", "Put jack stands under the vehicle.", "2026-11-18", "control"),
    story(base, "eyewash", "2026-11-08", "South wall eyewash.", "The south-wall eyewash has no weekly flush recorded for three weeks.", "Eyewash not flushed.", ["D", "III"], ["E", "III"], ["Flush and record the eyewash each week.", "Shop 2 supervisor", "Write the date on the tag."], "one month or less", "Flush the eyewash and mark the tag.", "2026-11-22", "decision"),
    story(base, "brake", "2026-11-09", "Waste cabinet.", "The brake-cleaner waste container was open at the end of the shift.", "Open waste container.", ["C", "III"], ["E", "III"], ["Close and label the container.", "Shop 2 supervisor", "Lid on at the end of the shift."], "one month or less", "Close the brake-cleaner container.", "2026-11-01", "open"),
    story(base, "guard", "2026-11-09", "North guardrail.", "Two bolts are missing from the north guardrail.", "Loose guardrail.", ["D", "III"], ["E", "IV"], ["Replace the bolts.", "Shop 2 supervisor", "Use the stock bolts in the tool room."], "one month or less", "Replace the guardrail bolts.", "2026-11-16", "completed"),
    story(base, "extinguisher", "2026-11-02", "Bay 4 column.", "The bay 4 fire extinguisher missed the monthly check.", "Extinguisher check missed.", ["D", "IV"], ["E", "IV"], ["Check the extinguisher and initial the tag.", "Shop 2 supervisor", "Monthly, on the first workday."], "one month or less", "Complete the extinguisher check.", "2026-11-05", "closed"),
  ];
}

function washStories(who: ReturnType<typeof ids>): Story[] {
  const base = { orgId: "org-wash", shopName: "Vehicle wash rack", commanderGrade: "O-5", ...who };
  return [
    story(base, "alarm", "2026-11-11", "Oil-water separator.", "The oil-water separator high-level alarm was not tested this month.", "Separator alarm untested.", ["C", "III"], ["D", "III"], ["Test the alarm and write the result.", "Wash-rack supervisor", "Use the monthly test sheet."], "one month or less", "Test the separator alarm.", "2026-11-25", "control"),
    story(base, "grate", "2026-11-11", "Exit grate.", "The exit grate is slick with mud and has no grit.", "Slip at the exit grate.", ["C", "III"], ["D", "III"], ["Scrub the grate and add grit.", "Wash-rack supervisor", "Before the next vehicle exits."], "one month or less", "Scrub the exit grate.", "2026-11-01", "open"),
    story(base, "drum", "2026-11-11", "Detergent pad.", "A detergent drum on the pad has no contents label.", "Unlabeled detergent drum.", ["D", "III"], ["E", "III"], ["Label the drum.", "Wash-rack supervisor", "Use the shop label."], "one month or less", "Label the detergent drum.", "2026-11-20", "hazard"),
    story(base, "backflow", "2026-11-01", "Hose bib.", "The hose-bib backflow preventer was due for replacement.", "Backflow preventer due.", ["D", "III"], ["E", "IV"], ["Replace the preventer.", "Wash-rack supervisor", "Install the stock preventer."], "one month or less", "Replace the backflow preventer.", "2026-11-04", "closed"),
  ];
}

function diningStories(who: ReturnType<typeof ids>): Story[] {
  const base = { orgId: "org-dining", shopName: "Dining facility", commanderGrade: "O-5", ...who };
  return [
    story(base, "grease", "2026-11-10", "Grease trap.", "The grease trap is past the date on the pump card.", "Grease trap overdue.", ["C", "III"], ["D", "III"], ["Pump the trap and file the card.", "Dining supervisor", "Call the pump contractor on the card."], "one month or less", "Pump the grease trap.", "2026-11-19", "decision"),
    story(base, "tile", "2026-11-10", "Dish machine.", "The tile by the dish machine holds water.", "Wet tile by the dish machine.", ["C", "III"], ["D", "IV"], ["Squeegee the tile and fix the drain slope.", "Dining supervisor", "Squeegee after each meal."], "one month or less", "Keep the dish-machine tile dry.", "2026-11-12", "completed"),
    story(base, "knives", "2026-11-10", "Prep line.", "The magnetic knife strip is loose and knives sit on the counter.", "Loose knife strip.", ["C", "II"], ["D", "III"], ["Refasten the strip.", "Dining supervisor", "Use the wall anchors in supply."], "one month or less", "Refasten the knife strip.", "2026-11-17", "initial"),
    story(base, "cylinder", "2026-11-10", "Drink station.", "The carbon-dioxide cylinder is not chained.", "Unsecured gas cylinder.", ["D", "II"], ["E", "III"], ["Chain the cylinder to the wall.", "Dining supervisor", "Use the wall chain already mounted."], "one month or less", "Chain the cylinder.", "2026-11-18", "control"),
    story(base, "hood", "2026-11-03", "Hood filters.", "Two hood filters were past the clean date.", "Hood filters past clean date.", ["D", "III"], ["E", "IV"], ["Clean the filters and write the date.", "Dining supervisor", "On the filter log."], "one month or less", "Clean the hood filters.", "2026-11-06", "closed"),
  ];
}

function harrowStories(who: ReturnType<typeof ids>): Story[] {
  const base = { orgId: "org-harrow", shopName: "Range support", commanderGrade: "O-5", ...who };
  return [
    story(base, "buffalo", "2026-11-07", "Range 2 water point.", "The water buffalo at range 2 is empty on a training day.", "Empty water buffalo.", ["C", "III"], ["D", "III"], ["Fill the buffalo before the range goes hot.", "Range supervisor", "Fill from the camp water point."], "one month or less", "Fill the range 2 water buffalo.", "2026-11-01", "open", "water"),
    story({ ...base, shopName: "Range support" }, "contain", "2026-11-07", "Range generator.", "The generator fuel tank has no secondary containment.", "Fuel tank without containment.", ["C", "II"], ["D", "II"], ["Place the tank in a containment berm.", "Range supervisor", "Use the spare berm at the motor pool."], "beyond one month", "Set the generator tank in containment.", "2026-11-28", "control", "tanks and spills"),
    story(base, "wire", "2026-11-07", "Range road.", "A communications wire crosses the range road at ankle height.", "Wire across the road.", ["C", "III"], ["E", "III"], ["Raise or mark the wire.", "Range supervisor", "Move it to the existing poles."], "one month or less", "Move the wire off the road.", "2026-11-15", "hazard"),
    story({ ...base, shopName: "Water point" }, "chlorine", "2026-11-07", "Water point log.", "Yesterday's chlorine residual was not written in the log.", "Chlorine residual not logged.", ["D", "III"], ["E", "III"], ["Write the residual each day the point is open.", "Water-point supervisor", "The log stays on the clipboard."], "one month or less", "Complete the chlorine log.", "2026-11-16", "decision", "water"),
    story({ ...base, shopName: "Water point" }, "hatch", "2026-11-01", "Storage tank.", "The storage-tank hatch was found unlatched.", "Unlatched tank hatch.", ["D", "III"], ["E", "IV"], ["Latch the hatch after each check.", "Water-point supervisor", "Latch before leaving the point."], "one month or less", "Latch the tank hatch.", "2026-11-02", "closed", "water"),
  ];
}

function meridianStories(who: ReturnType<typeof ids>): Story[] {
  const base = { orgId: "org-meridian", shopName: "Fuel farm", commanderGrade: "O-5", ...who };
  return [
    story(base, "alarm", "2026-11-06", "Tank 2.", "Tank 2 failed the monthly overfill-alarm test.", "Overfill alarm failed.", ["C", "II"], ["D", "II"], ["Repair the alarm and retest.", "Fuel-farm supervisor", "Retest before the next receipt."], "one month or less", "Repair and retest the tank 2 alarm.", "2026-11-01", "open", "tanks and spills"),
    story(base, "bond", "2026-11-06", "Fill stand.", "The bonding cable at the fill stand is frayed.", "Frayed bonding cable.", ["C", "II"], ["D", "III"], ["Replace the cable.", "Fuel-farm supervisor", "Use the spare cable in the shed."], "one month or less", "Replace the bonding cable.", "2026-11-18", "control", "tanks and spills"),
    story({ ...base, shopName: "Supply warehouse" }, "rack", "2026-11-06", "Aisle C.", "The storage rack in aisle C is not anchored to the floor.", "Unanchored storage rack.", ["D", "II"], ["E", "III"], ["Anchor the rack.", "Warehouse supervisor", "Use the floor anchors from supply."], "one month or less", "Anchor the aisle C rack.", "2026-11-21", "initial"),
    story({ ...base, shopName: "Supply warehouse" }, "horn", "2026-11-06", "Forklift.", "The warehouse forklift horn does not sound.", "Forklift horn inoperative.", ["C", "III"], ["E", "III"], ["Repair the horn before the forklift is used.", "Warehouse supervisor", "Dead-line the forklift until the horn works."], "one month or less", "Repair the forklift horn.", "2026-11-09", "completed"),
    story({ ...base, shopName: "Supply warehouse" }, "aisle", "2026-11-02", "Aisle A.", "The aisle stripe was worn through at the corner.", "Worn aisle stripe.", ["E", "IV"], ["E", "IV"], ["Repaint the stripe.", "Warehouse supervisor", "Paint after duty hours."], "one month or less", "Repaint the aisle stripe.", "2026-11-04", "closed"),
  ];
}

function story(
  base: {
    orgId: string;
    shopName: string;
    commanderGrade: string;
    safetyId: string;
    commanderId: string;
    supervisorId: string;
    employeeId: string;
  },
  key: string,
  inspectedOn: string,
  observation: string,
  finding: string,
  hazard: string,
  initial: [ProbabilityCode, SeverityCode],
  residual: [ProbabilityCode, SeverityCode],
  control: [string, string, string],
  duration: DurationText,
  action: string,
  dueOn: string,
  depth: Depth,
  programArea?: string,
): Story {
  return { id: `${base.orgId}-${key}`, ...base, inspectedOn, observation, finding, hazard, initial, residual, control, duration, action, dueOn, depth, programArea };
}

function ensureCrew(db: DatabaseSync, crew: Crew, passwordHash: string): void {
  if (crew.slug === "garrison") {
    ensureUser(db, "user-garrison-safety", crew.orgId, "garrison.safety@camp-sentinel.example", "Camp Sentinel Garrison Safety", null, passwordHash);
    ensureRole(db, "ur-garrison-safety", "user-garrison-safety", "safety officer", crew.orgId);
    return;
  }
  const who = ids(crew.slug);
  const label = crew.place === "Camp Sentinel" ? crew.orgName : crew.place;
  ensureUser(db, who.safetyId, crew.orgId, safetyEmail(crew), `${label} Safety Officer`, null, passwordHash);
  ensureUser(db, who.commanderId, crew.orgId, commanderEmail(crew), `${label} Commander`, "O-5", passwordHash);
  ensureUser(db, who.supervisorId, crew.orgId, supervisorEmail(crew), `${label} Supervisor`, null, passwordHash);
  ensureUser(db, who.employeeId, crew.orgId, employeeEmail(crew), `${label} Employee`, null, passwordHash);
  ensureRole(db, `ur-${crew.slug}-safety`, who.safetyId, "safety officer", crew.orgId);
  ensureRole(db, `ur-${crew.slug}-commander`, who.commanderId, "commander", crew.orgId);
  ensureRole(db, `ur-${crew.slug}-supervisor`, who.supervisorId, "supervisor", crew.orgId);
  ensureRole(db, `ur-${crew.slug}-employee`, who.employeeId, "employee", crew.orgId);
}

function safetyEmail(crew: Crew): string {
  if (crew.place === "Camp Sentinel") return `${crew.slug}.safety@camp-sentinel.example`;
  return `safety@${crew.slug === "harrow" ? "camp-harrow" : "camp-meridian"}.example`;
}

function commanderEmail(crew: Crew): string {
  if (crew.place === "Camp Sentinel") return `${crew.slug}.commander@camp-sentinel.example`;
  return `commander@${crew.slug === "harrow" ? "camp-harrow" : "camp-meridian"}.example`;
}

function supervisorEmail(crew: Crew): string {
  if (crew.place === "Camp Sentinel") return `${crew.slug}.supervisor@camp-sentinel.example`;
  return `supervisor@${crew.slug === "harrow" ? "camp-harrow" : "camp-meridian"}.example`;
}

function employeeEmail(crew: Crew): string {
  if (crew.place === "Camp Sentinel") return `${crew.slug}.employee@camp-sentinel.example`;
  return `employee@${crew.slug === "harrow" ? "camp-harrow" : "camp-meridian"}.example`;
}

function ensureStory(db: DatabaseSync, item: Story): void {
  if (exists(db, "finding", `loc-find-${item.id}`)) return;
  const order = ["hazard", "initial", "control", "decision", "open", "completed", "closed"];
  const at = (depth: Depth) => order.indexOf(item.depth) >= order.indexOf(depth);
  ensureEmptyInspection(db, `loc-insp-${item.id}`, item.orgId, item.shopName, item.inspectedOn, item.safetyId);
  db.prepare(
    `INSERT INTO observation (id, organization_id, inspection_id, text, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(`loc-obs-${item.id}`, item.orgId, `loc-insp-${item.id}`, item.observation, NOW, item.safetyId);
  const status = at("open") ? (item.depth === "closed" ? "action closed" : "action in progress") : "open";
  db.prepare(
    `INSERT INTO finding (id, organization_id, original_text, status, source_observation_id, source_report_id, program_area, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
  ).run(`loc-find-${item.id}`, item.orgId, item.finding, status, `loc-obs-${item.id}`, item.programArea ?? "materials", NOW, item.safetyId);
  if (!at("hazard")) return;
  db.prepare(
    `INSERT INTO hazard (id, organization_id, description, created_at, created_by) VALUES (?, ?, ?, ?, ?)`,
  ).run(`loc-haz-${item.id}`, item.orgId, item.hazard, NOW, item.safetyId);
  db.prepare("INSERT INTO finding_hazard (finding_id, hazard_id) VALUES (?, ?)").run(`loc-find-${item.id}`, `loc-haz-${item.id}`);
  if (!at("initial")) return;
  insertAssessment(db, `loc-as-i-${item.id}`, item, "initial", item.initial);
  if (!at("control")) return;
  const residualId = `loc-as-r-${item.id}`;
  insertAssessment(db, residualId, item, "residual", item.residual);
  db.prepare(
    `INSERT INTO control (id, organization_id, assessment_id, atp_category, hierarchy_step, what_text, who_text, how_text, created_at, created_by)
     VALUES (?, ?, ?, 'physical', 'engineering', ?, ?, ?, ?, ?)`,
  ).run(`loc-ctl-${item.id}`, item.orgId, residualId, item.control[0], item.control[1], item.control[2], NOW, item.safetyId);
  if (!at("decision")) return;
  const residual = lookupMatrix(MATRIX_CELLS, item.residual[0], item.residual[1]);
  const authority = lookupAcceptance(ACCEPTANCE_CELLS, {
    matrixLevel: residual.matrixLevel as MatrixLevel,
    durationText: item.duration,
    publicExposed: false,
    gradeText: item.commanderGrade,
  });
  db.prepare(
    `INSERT INTO risk_decision (id, organization_id, assessment_id, decision, decided_by, grade_text, duration_text, public_exposed, created_at, created_by)
     VALUES (?, ?, ?, 'accept', ?, ?, ?, 0, ?, ?)`,
  ).run(`loc-dec-${item.id}`, item.orgId, residualId, item.commanderId, item.commanderGrade, item.duration, NOW, item.commanderId);
  db.prepare(
    `INSERT INTO authority_check (id, organization_id, decision_id, result, basis, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(`loc-auth-${item.id}`, item.orgId, `loc-dec-${item.id}`, authority.result, authority.basis, NOW, item.commanderId);
  if (!at("open")) return;
  const actionStatus = item.depth === "closed" ? "closed" : item.depth === "completed" ? "completed" : "open";
  const completedBy = actionStatus === "open" ? null : item.supervisorId;
  db.prepare(
    `INSERT INTO corrective_action (
       id, organization_id, finding_id, hazard_id, description, owner_user_id, due_on, status, kind, completed_by, created_at, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'corrective', ?, ?, ?)`,
  ).run(
    `loc-act-${item.id}`,
    item.orgId,
    `loc-find-${item.id}`,
    `loc-haz-${item.id}`,
    item.action,
    item.supervisorId,
    item.dueOn,
    actionStatus,
    completedBy,
    NOW,
    item.safetyId,
  );
  if (actionStatus === "open") return;
  const hash = createHash("sha256").update(item.action).digest("hex");
  db.prepare(
    `INSERT INTO evidence (id, organization_id, action_id, file_name, content_hash, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(`loc-ev-${item.id}`, item.orgId, `loc-act-${item.id}`, "work-note.txt", hash, item.supervisorId, NOW);
  if (actionStatus === "completed") return;
  db.prepare(
    `INSERT INTO verification (id, organization_id, action_id, result, notes, verifier_user_id, created_at, created_by)
     VALUES (?, ?, ?, 'pass', 'The work matches the action.', ?, ?, ?)`,
  ).run(`loc-ver-${item.id}`, item.orgId, `loc-act-${item.id}`, item.safetyId, NOW, item.safetyId);
}

function insertAssessment(
  db: DatabaseSync,
  id: string,
  item: Story,
  phase: "initial" | "residual",
  pair: [ProbabilityCode, SeverityCode],
): void {
  const cell = lookupMatrix(MATRIX_CELLS, pair[0], pair[1]);
  db.prepare(
    `INSERT INTO risk_assessment (
       id, organization_id, hazard_id, phase, probability_code, severity_code, matrix_level, matrix_cell, doctrine_ref, estimated_by, created_at, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, item.orgId, `loc-haz-${item.id}`, phase, pair[0], pair[1], cell.matrixLevel, cell.matrixCell, cell.doctrineRef, item.safetyId, NOW, item.safetyId);
}

function ensureEmptyInspection(db: DatabaseSync, id: string, orgId: string, shopName: string, inspectedOn: string, safetyId: string): void {
  if (exists(db, "inspection", id)) return;
  db.prepare(
    `INSERT INTO inspection (id, organization_id, shop_name, inspected_on, inspector_user_id, status, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`,
  ).run(id, orgId, shopName, inspectedOn, safetyId, NOW, safetyId);
}

function ensureReport(db: DatabaseSync, id: string, orgId: string, text: string, name: string | null, showName: boolean, userId: string): void {
  if (exists(db, "employee_report", id)) return;
  db.prepare(
    `INSERT INTO employee_report (id, organization_id, text, reporter_display_name, show_name, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, orgId, text, name, showName ? 1 : 0, NOW, userId);
}

function ensureObligation(db: DatabaseSync, id: string, orgId: string, title: string, applicability: string, programArea: string, userId: string): void {
  if (exists(db, "obligation", id)) return;
  db.prepare(
    `INSERT INTO obligation (id, organization_id, title, applicability_text, program_area, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, orgId, title, applicability, programArea, NOW, userId);
}

function ensureWaste(db: DatabaseSync, id: string, orgId: string, obligationId: string | null, name: string, wasteKind: string, userId: string): void {
  if (exists(db, "waste_stream", id)) return;
  db.prepare(
    `INSERT INTO waste_stream (id, organization_id, obligation_id, name, waste_kind, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, orgId, obligationId, name, wasteKind, NOW, userId);
}

function ensureSpill(db: DatabaseSync, id: string, orgId: string, description: string, reportedTo: string, userId: string): void {
  if (exists(db, "spill", id)) return;
  db.prepare(
    `INSERT INTO spill (id, organization_id, description, reported_to, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, orgId, description, reportedTo, NOW, userId);
}

function ensureExposure(db: DatabaseSync, id: string, orgId: string, agent: string, shop: string, control: string, headcount: number, examPercent: number, userId: string): void {
  if (exists(db, "exposure_group", id)) return;
  db.prepare(
    `INSERT INTO exposure_group (id, organization_id, agent, shop, control_method, headcount, exam_completion_percent, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, orgId, agent, shop, control, headcount, examPercent, NOW, userId);
}

function ensurePractice(db: DatabaseSync, orgId: string, userId: string, objectiveId: string, status: string, label: string): void {
  const id = `loc-practice-${orgId}-${objectiveId}`;
  if (exists(db, "asohms_score", id)) return;
  db.prepare(
    `INSERT INTO asohms_score (id, organization_id, objective_id, practice_status, stage_label, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, orgId, objectiveId, status, label, NOW, userId);
}

function ensureOrg(db: DatabaseSync, id: string, parentId: string | null, name: string): void {
  if (exists(db, "organization", id)) return;
  db.prepare("INSERT INTO organization (id, parent_id, name, created_at, created_by) VALUES (?, ?, ?, ?, NULL)").run(id, parentId, name, NOW);
}

function ensureUser(db: DatabaseSync, id: string, orgId: string, email: string, displayName: string, grade: string | null, passwordHash: string): void {
  if (exists(db, "user", id)) return;
  db.prepare(
    `INSERT INTO user (id, organization_id, email, password_hash, display_name, grade_text, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
  ).run(id, orgId, email, passwordHash, displayName, grade, NOW);
}

function ensureRole(db: DatabaseSync, id: string, userId: string, role: string, orgId: string): void {
  if (exists(db, "user_role", id)) return;
  db.prepare(
    "INSERT INTO user_role (id, user_id, role_id, organization_id, created_at, created_by) VALUES (?, ?, ?, ?, ?, NULL)",
  ).run(id, userId, role, orgId, NOW);
}

function exists(db: DatabaseSync, table: string, id: string): boolean {
  if (!/^[a-z_]+$/.test(table)) return true;
  const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
  return Boolean(row);
}
