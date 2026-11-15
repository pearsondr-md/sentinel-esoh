# ASOHMS capability mapping

ASOHMS is the Army Safety and Occupational Health Management System. Army Directive 2024-09 makes it the Army standard. AR 385-10 paragraph 1-9 and DA Pam 385-10 chapter 2 describe it in public publications.

This mapping is a design aid for SENTINEL. It is not an official Army assessment, not an Army SOH Star evaluation, and not a completed set of the 48 criteria.

## What is verified, and what is only a count

**Verified from publications opened in this review**

- There are six capability objectives. The wording and the order are not identical in every public source. SENTINEL will keep one internal code and store each source’s label beside it.
- DA Pam 385-10 paragraph 2-3 lists supporting actions under those objectives. Those actions are procedures and guidelines from the pamphlet. They are not captioned as 48 criteria.
- Implementation is discussed as something commands plan, resource, evaluate annually, and have a higher headquarters look at on a multi-year cycle (DA Pam 385-10 paragraph 2-2 says every four years).

**Stated in public Army communication, and not yet validated as criterion text**

- A public Army article says the six objectives include 48 measurable criteria elements, and that organizations move through three maturity stages: documentation; implementation and execution; and sustainment and continuous improvement. It also says a successful maturity evaluation can lead to Army SOH Star recognition.
- The criteria sentences themselves were not in AR 385-10 or DA Pam 385-10 as a numbered list of 48. The ASOHMS portal is described by the Army safety site as CAC-restricted. A framework brochure linked from the Army article returned a 404 during this review.

Until a controlled official extract is loaded by a person who can confirm it, SENTINEL will show placeholders. A placeholder says that the official sentence is not in the system yet. It does not invent a sentence and call it a criterion. A score against a placeholder is a learning record. The screen that shows it will say that SENTINEL does not produce an official Army assessment.

## Internal codes and source labels

The internal code is stable so software does not break when a label is corrected. The labels are stored because the sources disagree. No one label is silently treated as the only official name.

- **CO-LEAD.** AR 385-10 paragraph 1-9a: “Leadership engagement and personnel/Soldier participation (program management).” DA Pam 385-10 paragraph 2-3a: “Leadership engagement and employee/Soldier participation.” The Army.mil implementation article uses “Leadership Engagement and Personnel/Soldier Readiness.”
- **CO-MISHAP.** Investigate and report mishaps, incidents, and illnesses. DA Pam 385-10 paragraph 2-3b. AR 385-10 paragraph 1-9d uses “Mishap, incident, and illness reporting and investigation.”
- **CO-TRAIN.** Conduct safety and occupational health training and promotion. DA Pam 385-10 paragraph 2-3c. AR 385-10 paragraph 1-9b is “Training and promotion.”
- **CO-INSPECT.** Conduct inspections and assessments. DA Pam 385-10 paragraph 2-3d. AR 385-10 paragraph 1-9c is “Inspections/assessments.”
- **CO-HAZARD.** Conduct hazard analysis and develop countermeasures. DA Pam 385-10 paragraph 2-3e. AR 385-10 paragraph 1-9e is “Hazard analysis and countermeasures.”
- **CO-HEALTH.** Health protection and readiness. DA Pam 385-10 paragraph 2-3f and AR 385-10 paragraph 1-9f. The same words appear in the public article.

AR 385-10 paragraph 1-9 lists them in the order lead, train, inspect, mishap, hazard, health. DA Pam 385-10 paragraph 2-3 and the public article use lead, mishap, train, inspect, hazard, health. SENTINEL will display the pamphlet and article order, because that is the order used in public ASOHMS explanations, and will keep the regulation’s letter (1-9a through 1-9f) on the record so the difference stays visible.

## What each objective is for

This is a plain-English reading of DA Pam 385-10 paragraph 2-3. It is not a substitute for the paragraph.

- **CO-LEAD.** Leaders publish a policy, set goals, resource the program, listen to Soldiers and employees, and look at the system every year. The pamphlet’s annual self-evaluation is a management review. It is not the same document as a workplace inspection.
- **CO-MISHAP.** Mishaps, incidents, and near misses are investigated, recorded, and used for trends. Investigations follow DA Pam 385-40. The pamphlet says the investigator is not the person involved and is not the supervisor of the injured employee. The point is failed or missing controls, not blame.
- **CO-TRAIN.** People learn the hazards of their work, their rights, and what to do in an emergency. Training is documented. A written personal protective equipment program sits here in the pamphlet.
- **CO-INSPECT.** The organization looks for hazards on a schedule, tracks them until they are controlled, and lets people report hazards in writing. DA Form 4755 is the form the pamphlet names. Feedback within 10 calendar days is in paragraph 2-3d. If the fix takes longer, people are told the expected time and the interim control.
- **CO-HAZARD.** Hazards are analyzed before and during the work: baseline surveys, task or process analyses, and a look before new equipment or chemicals are used. Industrial-hygiene characterization is part of this objective in the pamphlet. In the real Army that work is tied to systems such as DOEHRS-IH. SENTINEL will not connect to DOEHRS. A later slice may store a synthetic survey summary.
- **CO-HEALTH.** The occupational health program is staffed, people in exposure groups are tracked as counts, and there is a path back to work after a job-related injury. This is program management. It is not a medical record.

## Maturity stages

Public descriptions, including the Army article and the Safety Management Center of Excellence page, describe three stages. SENTINEL can store these stage names as labels on a placeholder assessment. The rubric that says what “complete” means for each official criterion is not in hand. Until it is, the stage field is explanatory, not a grade the Army would recognize.

- **Stage 1 — documentation.** Written policies, programs, and procedures exist for the objective.
- **Stage 2 — implementation and execution.** Those writings are in daily use. People are trained. Leaders see trend information.
- **Stage 3 — sustainment and continuous improvement.** The organization finds its own gaps and people can explain their own role.

DA Pam 385-10 paragraph 2-2 also says a higher-headquarters evaluation should occur every four years, and that an OSHA Voluntary Protection Programs Star may be evidence of a management system. The public article’s “Army SOH Star” is a recognition described in that article. These three ideas — stage labels, a four-year evaluation, and Star recognition — will stay as separate fields if they are ever stored. They will not be collapsed into one “certified” flag. None of them will be presented as an official result produced by this software.

A public training page says assessors mark sub-elements complete, in progress, or no action taken. That vocabulary can be used on placeholder rows as practice statuses: not started, in progress, complete. The screen copy will say the status is a local learning record.

## How SENTINEL will hold this

- Each organization (garrison, unit, shop) can own objectives.
- `asohms_criterion` may contain a row per objective that says “Official criterion text is not loaded. This row is a placeholder.” The official sentence stays blank.
- When a validated extract is available, a person loads it. The load records the source, the date, and who loaded it. SENTINEL still does not become the Army’s assessing authority. It stores the organization’s evidence and its own working notes.
- Evidence, gaps, and corrective actions link to the same action records used by the inspection workflow. Closing an action keeps the gap history.
- Supporting actions from DA Pam 385-10 paragraph 2-3 may be added later as cited excerpts, labeled “pamphlet supporting action,” with paragraph numbers. They will not be renumbered as criteria 1 through 48.

## What the first milestone uses

The first working milestone does not score ASOHMS. It does teach the objectives by contact:

- An inspection and a finding are the kind of work CO-INSPECT describes.
- A hazard and a risk assessment are the kind of work CO-HAZARD describes.
- A corrective action and a verification are the management loop the whole system depends on.
- A mishap record can be added only after DA Pam 385-40 thresholds are transcribed. Until then, the inspection path is the milestone.

The practice screen lists the six objectives and one placeholder row for each. It says, in the interface, that the result is not an official Army assessment. Evidence from an inspection still attaches through the finding and the corrective action.
