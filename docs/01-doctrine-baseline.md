# Doctrine and regulatory baseline

This note explains the authorities SENTINEL is designed around, in plain English. It is a study baseline dated 10 November 2026. It is not a legal opinion and not an official compliance determination.

The detailed publication-by-publication record, including what was actually opened, is in the [source register](02-source-register.md).

## What SENTINEL is

SENTINEL is a demonstration of how an Army organization could manage environment, safety, and occupational health as one system of records: find a problem, assess it, assign the work, fix it, check the fix, keep the original record, and report the status.

The shape of that system comes from Army safety and environmental policy, not from a generic safety application with Army words added later. The management idea at the center is the Army Safety and Occupational Health Management System (ASOHMS), directed by Army Directive 2024-09 and described in AR 385-10 and DA Pam 385-10.

The first software milestone is narrower than the whole mission. It is the inspection-to-verification path in the [workflow note](08-workflow.md). Environmental programs, occupational health, executive views, and AI come after that path is understood.

## Authority layers

These are different kinds of rules. SENTINEL will store the layer with each source so a technique publication is never treated as a statute.

- **Statute.** A law passed by Congress. Examples named by the Army publications reviewed here include the Occupational Safety and Health Act (Public Law 91-596) and environmental laws such as the Clean Air Act, Clean Water Act, Resource Conservation and Recovery Act, Comprehensive Environmental Response, Compensation, and Liability Act, National Environmental Policy Act, Safe Drinking Water Act, and National Historic Preservation Act.
- **Federal regulation.** A binding rule in the Code of Federal Regulations. AR 385-10 says it implements 29 CFR 1960 and other federal safety rules. Environmental media rules live mainly in Title 40. The current wording of a CFR part must be read on [ecfr.gov](https://www.ecfr.gov/) at the time of use. This baseline does not restate those parts.
- **DoD directive or instruction.** Binding policy inside the Department of Defense. DoDD 4715.1E is the ESOH policy directive. DoDI 6055.01 is the DoD safety and occupational health instruction cited by Army Directive 2024-09.
- **Army directive.** Policy from the Secretary of the Army. Army Directive 2024-09 is current policy of this kind. The directive itself says it is rescinded when a revised AR 385-10 that incorporates it is published.
- **Army regulation.** Department of the Army policy. AR 385-10 is safety and occupational health policy. AR 200-1 is environmental policy. In AR 200-1, “will” and “must” mean the action is mandatory.
- **DA pamphlet.** Procedures for carrying out a regulation. DA Pam 385-10, DA Pam 385-30, and DA Pam 385-40 are this layer. A pamphlet does not replace the regulation.
- **Doctrine.** How the Army describes operating. ATP 5-19 is the risk-management doctrine. It tells leaders how to identify hazards, assess them, develop controls, decide, implement, and supervise. It does not replace OSHA or an Army regulation.
- **Technical guidance and local policy.** Engineer manuals, installation standard operating procedures, permits, and state, local, or host-nation rules. These differ by place. SENTINEL must store applicability on the obligation. It must not assume every installation has the same permit or the same stricter local rule.

When an Army publication conflicts with a statute or federal regulation, AR 385-10 paragraph 1-11 says the more stringent requirement applies. That paragraph also says conflict is resolved at the lowest level that can resolve it, with coordination during joint operations.

## The management system

Army Directive 2024-09, dated 7 August 2024, makes ASOHMS the Army standard for safety and occupational health management. It applies to the Regular Army, the Army National Guard, and the U.S. Army Reserve. It points back to 29 CFR 1960, DoDI 6055.01, and AR 385-10. The directive says organizations should be fully compliant by the end of calendar year 2030.

The directive says an effective system should identify and manage risk, keep two-way communication with Soldiers and employees, use data and trends, and treat safety as part of decisions before a loss occurs. It assigns oversight to the Assistant Secretary of the Army (Installations, Energy and Environment).

Public Army news stories have also mentioned 2028 as an integration target. Those stories are not the directive. Until a revised regulation says otherwise, the date in the directive is the end of calendar year 2030.

AR 385-10 paragraph 1-9 defines ASOHMS as the plans and procedures used to evaluate the safety and occupational health program at every level. It names six capability objectives and says the mandatory procedures are in DA Pam 385-10. DA Pam 385-10 chapter 2 then gives supporting actions for those objectives. A public Army article says the framework has 48 measurable criteria. That numbered criteria set was not in the open regulation or pamphlet text reviewed for this baseline. The [ASOHMS mapping](03-asohms-mapping.md) explains how SENTINEL will hold a placeholder instead of invented criteria.

## Safety and mishaps

AR 385-10, 24 July 2023, effective 24 August 2023, is titled *The Army Safety and Occupational Health Program*. It superseded the 24 February 2017 edition. The proponent on the Army Publishing Directorate record is ASA (IE&E).

The regulation covers responsibilities, councils, risk management, occupational health at the program level, and many specialized safety areas. For this project the near-term chapters are:

- Paragraphs 1-8 through 1-18, for unit safety officers, ASOHMS, leader duties, and safety councils.
- Chapter 6, for risk management and the hierarchy of controls.
- Chapter 7, for what occupational health is, at a program level. Individual medical records stay outside SENTINEL.

DA Pam 385-40, 24 July 2023, is the mishap investigation and reporting procedure. It uses the word **mishap**. It points reporting to the Army Safety Management Information System. SENTINEL will not connect to that system. Class A through D thresholds were not transcribed in this review. They will be looked up in that pamphlet before any class rule is coded. Until then, class is an empty lookup, not a guessed dollar amount.

## Risk management

Risk is the part of the design that must stay faithful to doctrine. The full distinction is in the [workflow note](08-workflow.md). The short version is:

1. **Doctrinal matrix result.** ATP 5-19, 9 November 2021, is the current risk-management doctrine found on the Army Publishing Directorate. Step 2 estimates probability (A through E) and severity (I through IV). Paragraphs 1-45 through 1-48 state which combinations are extremely high, high, medium, or low. That result is a lookup. It is not a generic 1-to-5 score, and it is not a person’s permission to change the cell.
2. **Human risk decision.** ATP 5-19 paragraphs 1-7, 1-8, and 1-49 describe a commander, leader, or responsible individual deciding to accept or not accept residual risk. The decision is about the risk. It does not rewrite the matrix.
3. **Risk-acceptance authority.** DA Pam 385-30, 2 December 2014, still listed on the Army Publishing Directorate, says who may accept risk. Paragraphs 4-4 and 4-5 and Table 4-1 tie authority to residual level, duration, and who owns the resources needed to control the hazard. Parts of Table 4-1 were readable. The medium and low rows were not reliable in the text extract. Those rows, and any delegation or other exception, stay unimplemented until the table is transcribed from the PDF and checked.

DA Pam 385-30 is older than the current ATP 5-19. Use the 2021 ATP for the assessment method. Use the pamphlet for acceptance procedure only where the pamphlet text has been read. Where they might disagree, do not invent a reconciliation.

ATP 5-19 prescribes DD Form 2977 for deliberate risk assessments. A SENTINEL assessment can follow that worksheet’s ideas (hazard, initial risk, controls, residual risk, who implements, who approves) without copying the blank form.

Two control vocabularies both appear in current publications, and they answer different questions:

- ATP 5-19 paragraph 1-50 groups controls as educational, physical, or hazard elimination. The form must record at least what, who, and how (paragraph 1-59).
- AR 385-10 paragraph 6-5, for industrial-based operations, orders controls as elimination, substitution, engineering controls, administrative controls, then personal protective equipment.

A control record can carry both labels. Neither list is a score.

## Environment

AR 200-1, *Environmental Protection and Enhancement*, 15 April 2026, superseded the 13 December 2007 edition. The 2007 edition is not the baseline. The proponent on the Army Publishing Directorate record is ASA (IE&E).

The 2026 contents run from environmental policy and planning through asset management, pest management, cultural resources, pollution prevention, munitions on ranges, materials, waste, tanks and spills, cleanup, environmental technology, operational noise, program management, checking and corrective action, and management review.

Environmental duties follow statutes, federal and state regulations, permits, and, overseas, country-specific Final Governing Standards. AR 200-1 says permits, enforcement, and spills need early coordination with legal counsel. SENTINEL can track an obligation and a finding. It cannot declare that an installation is in compliance.

Environmental workflows are a later capability. The data model leaves room for them so the first safety workflow does not have to be redesigned. See the [traceability matrix](04-traceability-matrix.md).

## Occupational health

AR 40-5, 12 May 2020, and DA Pam 40-11, 18 May 2020 with an administrative revision dated 27 March 2025, are the public Army public-health pair found on the Army Publishing Directorate. AR 385-10 chapter 7 points to them for occupational health objectives. DoDI 6055.05 and DoDM 6055.05 cover occupational and environmental health and occupational medical examinations.

SENTINEL’s later occupational-health slice, if built, will store program facts only: exposure groups, control methods, headcounts, and completion percentages. It will not store individual medical records, exam results, or diagnoses. DoDM 6055.05 is the boundary marker for the individual-exam world this demo will not enter.

AR 11-35, *Occupational and Environmental Health Risk Management*, dated 11 May 2016, appeared as active on an Army Publishing Directorate regulations list. The PDF was not opened. It is not yet a designed rule set. See the source register.

## What this baseline refuses to pretend

- The 48 criteria have not been validated from a controlled source. Placeholder rows are training structure only.
- A maturity label in SENTINEL is not an Army SOH Star and not an official assessment.
- Catalog status “active” on the day a page was opened is a point-in-time fact. It does not keep the publication current tomorrow. Secondary websites that mirror the catalog are not used here as proof of currency.
- Simplified numbers, if a lesson needs them, will be labeled illustrative. The ATP 5-19 matrix is not one of those simplifications. It is the doctrinal lookup, once the twenty cells are encoded from paragraphs 1-45 through 1-48 and checked.
- AI, when it is added later, may explain a record. It does not assign a matrix result, accept risk, or close a record.
