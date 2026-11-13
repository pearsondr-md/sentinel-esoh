# Day 7 — week 1 review

This note closes the first week. It records what is in the repository, the rule from day 1, and the workflow correction from day 7. Keep a sentence only if you can explain it from the research notes.

## What is in the repository

Two commits are on the branch.

- `aa95d3c` (10 November 2026) adds the research notes: doctrine baseline, source register, ASOHMS mapping, traceability matrix, product requirements, architecture, data model, workflow, security and AI governance, and the roadmap.
- `d585735` (12 November 2026) rebalances the 42-day plan around one Cursor practice per day and adds `docs/learning/day-01.md`.

No application code exists yet. The first software milestone is still the path in `docs/08-workflow.md` and `docs/10-roadmap.md`: inspection, finding, hazard, risk assessment, corrective action, verification. Environmental compliance, occupational health, executive analytics, and a live AI call stay after day 42.

Days 2 through 6 have no files in `docs/learning/`. The day-1 note is the only earlier learning record.

Uncommitted work from this session:

- `docs/08-workflow.md` splits the old “decide and assign” step.
- This file.

## Day 1 — authority layers

`docs/learning/day-01.md` keeps five sentences. Each one names a different kind of rule from `docs/01-doctrine-baseline.md`. The baseline stores the layer with the source so a technique publication is never stored as a statute.

1. **Statute.** A law passed by Congress. The Occupational Safety and Health Act (Public Law 91-596) is the example in the day-1 note.
2. **Federal regulation.** A binding rule in the Code of Federal Regulations. 29 CFR 1960 is the example. AR 385-10 says it implements that rule. The current wording is read on ecfr.gov when it is used. The baseline does not restate the regulation.
3. **Army regulation.** Department of the Army policy. AR 385-10 is the safety and occupational health regulation. Paragraph 1-9 defines ASOHMS and says the mandatory procedures are in DA Pam 385-10.
4. **DA pamphlet.** Procedures for carrying out a regulation. DA Pam 385-10 carries out AR 385-10. A pamphlet is its own layer.
5. **Doctrine.** How the Army describes operating. ATP 5-19 is risk-management doctrine. Paragraphs 1-45 through 1-48 turn a probability letter and a severity roman numeral into extremely high, high, medium, or low. That result is the published cell.

The baseline also names DoD directives and instructions, Army directives, and local policy. The day-1 note practices five layers. It does not claim those are the only layers.

## Day 7 — three risk records

The workflow note had one step called “decide and assign.” In that step the commander recorded accept or reject against the residual assessment, and the server wrote an authority check in the same step. The opening loop was “identify, assess, assign,” so the decision and the authority check had no place of their own. The residual matrix result was the input that step acted on.

`docs/07-data-model.md` already stores three rows. An assessment has one matrix result. A decision refers to one residual assessment. That decision has one authority check. The numbered steps now follow that chain.

The Camp Sentinel story is the check. Shop 2, quarterly inspection, unlabeled container.

1. **Matrix result.** The safety officer estimates probability (A–E) and severity (I–IV). The server looks up ATP 5-19 paragraphs 1-45 through 1-48 and stores the level and the cell. Controls are written, probability and severity are estimated again, and the server looks up the residual cell the same way. There is no field that sets extremely high, high, medium, or low to something other than that cell. A wrong estimate is a new assessment. The old assessment stays.
2. **Human decision.** The commander records accept or reject against that residual assessment, with who decided and when. ATP 5-19 paragraphs 1-7, 1-8, and 1-49 describe that decision. Accepting the risk leaves the cell as the matrix produced it. Rejecting the risk leaves the same cell.
3. **Authority check.** The server records allowed or blocked against verified cells only. DA Pam 385-30 paragraphs 4-4 and 4-5 and Table 4-1 say who may accept risk. The medium and low rows, the precise column headers, and written delegation were not reliable in the text extract, so an unverified cell blocks acceptance. A block is stored. It is the product working as designed. The action can still be assigned. Work does not wait on a forbidden acceptance.

ATP 5-19 paragraph 1-14 names five steps: identify the hazards, assess the hazards, develop controls and make risk decisions, implement controls, supervise and evaluate. The product loop is longer because the authority check is a pamphlet procedure, and because the matrix lookup, the accept-or-reject record, and the authority result are three stored facts. Close keeps the original finding text, both matrix results, the decision, and the authority check.

## What to check before accepting this note

- Day 1, sentence 5, still calls ATP 5-19 doctrine. The workflow edit does not turn it into a regulation.
- The workflow steps Decide, Check authority, and Assign are three records. Assign is allowed when the authority check is blocked.
- No new module was added. No risk level was typed in by hand. No ASOHMS criterion was invented.
- Table 4-1 is still limited to the cells the source register marks as read. This note does not fill in the medium and low rows.

## Where week 2 starts

Day 8 scaffolds `client` (Vite, React, TypeScript, Tailwind) and `server` (Express, TypeScript). Each dependency in `package.json` gets a name and a purpose. A dependency you cannot explain comes out. The record rule for that week is in the data model: a finding’s original text stays, and one unit does not read another unit’s drafts.
