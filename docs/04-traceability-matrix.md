# Regulatory and doctrine traceability

This matrix connects each SENTINEL capability to the authority that justifies it, and to the limit on what the software may decide. Citations are only as strong as the [source register](02-source-register.md). Where the register says unresolved, this matrix does not turn the gap into a requirement.

The first build implements one row in software: the core operational path. Later rows are requirements the design must be able to hold. They are not scheduled inside the 42 one-hour days except as orientation reading. See the [roadmap](10-roadmap.md).

## Core operational path (first milestone)

**Capability.** Inspection, observation, finding, hazard, risk assessment, corrective action, and verification. Original finding text remains after the action is closed.

**Authorities.**

- Inspections, written hazard reports, tracking, and employee feedback: DA Pam 385-10 paragraph 2-3d. DA Form 4755 is the named employee-report form. The 10-calendar-day feedback practice is in that paragraph.
- Hazard analysis and controls: DA Pam 385-10 paragraph 2-3e; ATP 5-19 paragraphs 1-14 and 1-33 through 1-50; AR 385-10 paragraph 6-5 for the industrial hierarchy of controls.
- Human acceptance of residual risk, separate from the matrix: ATP 5-19 paragraphs 1-7, 1-8, and 1-49.
- Who may accept: DA Pam 385-30 paragraphs 4-4 and 4-5 and Table 4-1, only for cells that have been transcribed and checked. Unverified cells are not rules yet.
- Record of what, who, and how: ATP 5-19 paragraph 1-59, aligned with the idea of DD Form 2977. The blank form is not copied into the repo.

**What SENTINEL may do.** Store the records, compute the matrix cell from probability and severity, record a human accept-or-reject decision, and refuse to store an acceptance when the authority row has not been verified.

**What SENTINEL will not do.** Assign the matrix cell by hand, override a cell, delegate authority, lower an overall risk below the highest hazard, or declare the organization compliant.

## Mishap investigation

**Capability.** A mishap or near-miss record, linked to hazards and actions, investigated by someone other than the involved person or the injured person’s supervisor.

**Authorities.** DA Pam 385-10 paragraph 2-3b; DA Pam 385-40 as the procedure pamphlet; DoDI 6055.07 as the DoD reporting instruction once the current WHS file is confirmed.

**Limit.** Class thresholds, notification clocks, and cost rules are unresolved. The first milestone does not include mishap classification. The data model can add the record later without breaking findings.

## Environmental compliance

**Capability.** Later. Obligations and permits, materials, waste, air, water, spills, pollution prevention, natural and cultural resources, and environmental findings that use the same corrective-action path as safety findings.

**Authorities.** AR 200-1 (15 April 2026), at chapter level as read in the contents and sampled sections. Statutes and 40 CFR parts are the legal layer and vary by installation, state, and overseas Final Governing Standards. AR 200-1 chapter 16 is checking and corrective action. Chapter 17 is management review.

**Chapter map for a future requirements model.**

- Permits and other legal duties: planning and the media chapters. The issuing government and the permit text are data.
- Air: environmental asset management discussion; Clean Air Act; the regulation text reviewed cites 40 CFR 71.1 in connection with Title V.
- Water, wastewater, and stormwater: Clean Water Act and Safe Drinking Water Act passages in the same edition.
- Materials: chapter 9. Waste: chapter 10, including the distinction between Resource Conservation and Recovery Act Subtitle C waste and other wastes such as certain medical waste.
- Tanks and spills: chapter 11. A spill can also be a mishap link when the facts support both.
- Pollution prevention: chapter 7. It is its own program, not a synonym for “in compliance.”
- Cultural resources: chapter 6, including the National Historic Preservation Act relationship described in the regulation. This is not modeled as “just another permit.”
- Natural resources: discussed with environmental asset management. Pest management is chapter 5. Operational noise is chapter 14. Cleanup is chapter 12. Munitions on ranges is chapter 8.
- Corrective action and management review: chapters 16 and 17.

**Limit.** Obligations, waste streams, and spills are tracked, and each can open a finding on the existing action path. The rest of the chapter map is not a screen yet. SENTINEL will not decide that a permit condition is met. Legal coordination, which AR 200-1 requires for permits, enforcement, and spill liability, stays a human step.

## Occupational health

**Capability.** Program information only: exposure groups, control methods, number of people, and percent of required exams complete.

**Authorities.** AR 385-10 chapter 7; AR 40-5 and DA Pam 40-11 as the publications those paragraphs cite; DoDI 6055.05 once the current change is confirmed; DoDM 6055.05 as the boundary for individual exams. ASOHMS objective CO-HEALTH. AR 11-35 is not traced to a rule until its PDF is opened.

**Limit.** The exposure-group record stores the five program fields and rejects any other field, including a diagnosis. No individual medical record, no lab result, and no sending of individual health information to an AI service. Aggregate counts are synthetic.

## Executive operational picture

**Capability.** A council-style view of open findings, overdue actions, inspections, exposure-group counts, and environmental records the organization already holds.

**Authorities.** AR 385-10 paragraph 1-17 lists the kinds of information a Safety and Occupational Health Advisory Council reviews, including ASOHMS status, inspection completion, training completion, mishap summaries, and abatement of higher-priority facility hazards. Minutes are kept at least five years. OSHA rate formulas are mentioned there. The formulas will be taken from the current 29 CFR 1904 method when that view is built, not memorized now.

**Limit.** The view reports SENTINEL records. It is not a readiness rating and not an official assessment. ASOHMS status, training completion, mishap summaries, RAC abatement, OSHA rates, and council minutes are listed as not stored. The OSHA formulas stay unread until taken from the current 29 CFR 1904 text.

## ASOHMS management

**Capability.** Later practice screens for six objectives, placeholder criteria, evidence, gaps, and actions. Maturity stage labels may be stored as notes.

**Authorities.** Army Directive 2024-09; AR 385-10 paragraph 1-9; DA Pam 385-10 chapter 2. The 48 criteria and the official scoring rubric are unresolved. See the [ASOHMS mapping](03-asohms-mapping.md).

**Limit.** Placeholder text and practice statuses will be labeled as local learning records. SENTINEL will not state that an organization earned an Army SOH Star, passed a higher-headquarters evaluation, or received an official maturity rating.

## AI assistance

**Capability.** Later. Explanations of records already in SENTINEL, and questions about sources that are actually in the source register, with the two kinds of citations kept visually separate.

**Authorities.** No publication reviewed here authorizes a model to set a risk level, accept risk, assign an action, or close a record. Those acts stay with people under ATP 5-19 and DA Pam 385-30. The governance rules are in the [security note](09-security-ai-governance.md).

**Limit.** The model sees only records the server retrieved for that user. It does not receive database credentials. Unverified citations are marked unverified.

## Authorities deliberately left out of the first design rules

These are real programs. They are named so they are not forgotten and not faked.

- Acquisition system safety, MIL-STD-882, and DA Pam 385-16. DA Pam 385-30 Table 4-1 note 4 points fielded acquisition hazards there. No acquisition override will be built in their place.
- Range deviations, AR 385-63. Table 4-1 note 5 points there. Out of scope.
- Ammunition, explosives, and chemical-agent deviations, DA Form 7632 and DA Pam 385-30 paragraph 4-6. Out of scope.
- Live connections to the Army Safety Management Information System, DOEHRS-IH, or the ASOHMS portal.

## Traceability fields to store later

When source links are entered in the database, each link should be able to hold:

- Internal capability name.
- Source identifier and authority layer.
- Paragraph, chapter, or table.
- Whether the citation status is verified on a stated review date, or still unresolved.
- The product limit (store, compute, refuse, or do not build yet).

That structure keeps a news article from being stored with the same weight as a regulation paragraph.
