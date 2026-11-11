# First workflow

The first working milestone is this path:

**Inspection → finding → hazard → risk assessment → corrective action → verification.**

Environmental compliance, occupational health, executive analytics, and AI are later. They should create findings and actions on this same path rather than invent a second one.

The path is the project’s operational loop — identify, assess, assign, remediate, verify, close, report — lined up with the five steps of risk management in ATP 5-19 paragraph 1-14. “Report” in the first milestone means the record can be read back in full. A council dashboard is a later capability.

## The story

Camp Sentinel, Shop 2, quarterly inspection. The inspector sees a waste container with no label. That is an observation. The finding text is: “Unlabeled container in Shop 2, north wall, observed during the quarterly inspection.” Those words remain even after the label is applied and the action is closed.

The finding is linked to a hazard: people may handle unknown contents. The safety officer estimates probability and severity. The server returns the matrix result. Controls are written: identify the contents, label or dispose of the container, and tell the shift what the label means. Probability and severity are estimated again with those controls assumed in place. The server returns the residual matrix result. A commander records a separate decision to accept or not accept that residual risk. The authority check runs against verified table cells only. A supervisor is assigned the action. Someone else verifies the label. The action closes. The original finding is still on the inspection.

The container is a teaching example. It is not a statement that a real waste rule was evaluated. Waste-program screens are later. The example is enough to force the safety records to exist.

## Steps and who acts

1. **Identify.** An inspector creates an inspection and an observation, or an employee files a written report. A safety officer creates the finding from that source. The finding’s original text is saved and not edited. Employee reports can be shown without the reporter’s name.
2. **Assess.** The safety officer enters probability (A–E) and severity (I–IV) for the initial assessment. The server looks up ATP 5-19 paragraphs 1-45 through 1-48 and stores the level. The officer then enters controls and a residual probability and severity. The server looks up the residual level the same way. Residual risk is a second use of the same matrix after the estimates change. It is not a percent discount and not a typed-in level.
3. **Decide and assign.** The commander records accept or reject against the residual assessment. The server writes an authority check. If the check is blocked, the action can still be assigned to fix the hazard. Work does not wait on a forbidden acceptance. An acceptance is simply absent.
4. **Remediate.** The assigned person completes the action and attaches evidence.
5. **Verify.** A different user records pass or fail. The server rejects a verification submitted by the user who completed the action.
6. **Close.** A passed verification allows the action to close. The finding status becomes “action closed.” The original text, both matrix results, the decision, and a failed verification if one happened earlier all remain.
7. **Report.** Any authorized user in the organization can open the chain and read it in order. That is the report for this milestone.

## Three risk facts

These are different questions. The software stores them in different rows, described in the [data model](07-data-model.md).

### Doctrinal matrix result

ATP 5-19 step 2 asks how probable a harmful event is and how severe it would be if it happened. Probability and severity are estimates a person makes from the situation and from similar past events. Paragraphs 1-34 through 1-38 and 1-40 through 1-43 define the words. The exposure examples in the probability paragraphs (including “about 500 exposures”) illustrate the words. They are not inputs to an automatic calculator.

The level is the published combination:

- Extremely high: frequent and catastrophic (IA), likely and catastrophic (IB), frequent and critical (IIA). Paragraph 1-45.
- High: occasional or seldom and catastrophic (IC, ID); likely or occasional and critical (IIB, IIC); frequent and moderate (IIIA). Paragraph 1-46.
- Medium: unlikely and catastrophic (IE); seldom and critical (IID); likely or occasional and moderate (IIIB, IIIC); frequent and negligible (IVA). Paragraph 1-47.
- Low: unlikely and critical (IIE); seldom or unlikely and moderate (IIID, IIIE); likely, occasional, seldom, or unlikely and negligible (IVB, IVC, IVD, IVE). Paragraph 1-48.

The person estimates A–E and I–IV. The matrix result is the cell. There is no field and no button that sets extremely high, high, medium, or low to something other than that cell.

If the estimate was wrong, the person enters a new assessment with a new probability or severity. The old assessment remains in history. That is a corrected estimate, not an override.

### Human risk decision

ATP 5-19 paragraphs 1-7, 1-8, and 1-49 describe the decision to accept or not accept residual risk. The responsible person weighs the residual risk against the reason for the activity. In SENTINEL that decision is its own record: accept or reject, who decided, and when. Rejecting the risk does not change the matrix result. Accepting the risk does not change it either. The hazard row still shows the same level the matrix produced.

The first milestone records this decision on a single hazard. DA Pam 385-30 includes a passage that the overall residual for an operation is equal to or higher than the highest hazard residual, and that a commander may judge the overall level higher when hazards combine. That passage is about the overall operation. It does not lower a level and does not edit a cell. It is not implemented in the first milestone. It will not be implemented later as a free-text override. If it is built, it will be a separate overall-mission field that cannot be set below the highest hazard’s matrix result, and only after the printed paragraphs are checked again.

### Risk-acceptance authority

DA Pam 385-30 paragraphs 4-4 and 4-5 say the level, the duration, and the ownership of the resources determine who may accept the risk. Duration is not chopped into smaller pieces to qualify for a lower authority. Paragraph 4-4c says commands publish their approval authority or adopt Table 4-1 in writing.

Only authority rules that have been read and checked will be encoded. From this review, the safe statement is limited:

- Table 4-1 exists and is the pamphlet’s authority table for deviations, and paragraph 4-5 also points general risk acceptance documentation to that table.
- Note 3, as read, says high risk beyond one month, or extremely high risk, is always accepted by a general officer or flag officer.
- Paragraph 4-4f(2), as read, says public exposure to high or extremely high risk is accepted by the Army headquarters commanding general.
- The medium and low rows, the precise column headers, and written delegation (note 1) were not reliable in the text extract.

The first build therefore blocks acceptance when the matching cell is not in the verified set. A block is the product working as designed. It is not an error to hide. Notes that point to other publications — acquisition programs (DA Pam 385-16), ranges (AR 385-63), and ammunition or chemical-agent deviations (DA Form 7632) — are out of scope. SENTINEL will not add an “exception” button to cover them.

No grade in the Camp Sentinel seed data will be configured as a general officer unless a lesson specifically needs to show an allowed extremely-high acceptance. The ordinary shop story should use estimates that the learner can explain. If the learner chooses estimates that produce extremely high risk, the interesting result is a blocked acceptance and an open action, which is a true picture of the rule.

## Other workflow rules

- The user who completes an action cannot verify it.
- A commander’s decision and a safety officer’s estimate are different users in the seed data, so the learner can see that estimating and accepting are different duties. The publications do not forbid one person from knowing both skills. The split in the demo is there to make the records obvious.
- Mishap investigations, when they are added, follow DA Pam 385-10 paragraph 2-3b: the investigator was not involved and does not supervise the injured employee. That rule is not faked with a medical record. The first milestone does not include mishaps.
- AI is not on this path. When it exists, it will be unable to call the functions that write matrix results, decisions, assignments, verifications, or closures.

## What “done” means for the milestone

A learner can run the Camp Sentinel story from inspection through verification, show another person the original finding after close, point at the matrix cell and the ATP paragraph, point at a separate accept or reject record, and show a blocked authority check without using any override.
