# 42-day roadmap

About **one hour a day**, for 42 days. The goal is to understand the doctrine and the core workflow well enough to explain them. Feature count is the thing that gives way when the hour is full.

If a day ends with a clear note in your own words, that day counts. Do not start the next feature in the same hour.

The only working software milestone inside these 42 days is:

**Inspection → finding → hazard → risk assessment → corrective action → verification.**

Environmental compliance, occupational health, executive analytics, and AI are the next block, after day 42. Days 40–42 only orient you to why they wait. They do not start those modules.

Stack, when code starts: React, TypeScript, Tailwind, Vite, Node, Express, SQLite, and Git. No extra infrastructure. Read [the architecture note](06-architecture.md) on the day code begins. Do not expand it.

Publications below are the ones in the [source register](02-source-register.md). Re-open the official PDF. Do not rely on this roadmap as a substitute for the paragraph.

## Week 1 — Learn the layers (days 1–7)

No application code. The skill is telling a statute, a regulation, a pamphlet, and doctrine apart.

- **Day 1.** Read the [README](../README.md) and the authority-layer section of the [baseline](01-doctrine-baseline.md). Write five sentences that each use one layer correctly.
- **Day 2.** Read Army Directive 2024-09 all the way through. It is short. Note the 2030 date, the two-year instruction to revise AR 385-10, and what the directive does not contain (it does not list 48 criteria).
- **Day 3.** Read AR 385-10 paragraphs 1-8 and 1-9. In your own words, describe a unit safety officer and the six objectives. Keep both the regulation’s labels and the pamphlet’s labels. Do not merge them.
- **Day 4.** Read AR 385-10 paragraphs 1-10 through 1-18. List what a safety council looks at. Notice that a dashboard of those items is a later product, because it needs records you have not built.
- **Day 5.** Read DA Pam 385-10 paragraphs 2-1 and 2-2. Explain how a pamphlet differs from AR 385-10. Note the four-year evaluation sentence and the OSHA VPP sentence, and that neither is an Army SOH Star by itself.
- **Day 6.** Read DA Pam 385-10 paragraph 2-3a only. Count the supporting actions you see. Write down that they are not labeled “the 48 criteria.”
- **Day 7.** One page: what ASOHMS is, what is still placeholder, and which date controls (the directive’s 2030) when a news article disagrees. No code.

## Week 2 — See the core records on paper (days 8–14)

Still no full application. You are learning the path and the minimum tools.

- **Day 8.** Read the [workflow](08-workflow.md) story once. Draw the Camp Sentinel unlabeled-container chain by hand: inspection, observation, finding, hazard, action. Leave risk off the drawing today.
- **Day 9.** Read the [data model](07-data-model.md) sections on finding, hazard, and record events. Explain why the original finding text is not updated when the action closes.
- **Day 10.** Read ATP 5-19 paragraphs 1-7, 1-8, and 1-14 only. Write the five steps in your own words. Mark which step is a decision and which steps are analysis.
- **Day 11.** Git basics: a repository, a commit, and why these notes are worth committing before code exists. Create the local repository only if you want the notes under version control. Do not add application packages.
- **Day 12.** What a type is. Using the shared ideas in the architecture note, write on paper the fields of a finding and of a risk assessment. Include `matrix_level` as something the server fills.
- **Day 13.** What an HTTP request is. Say which requests the first milestone needs (create inspection, create finding, create assessment, create action, create verification). One sentence each on what the server must refuse.
- **Day 14.** Re-read your week-1 page and your drawing. Fix anything that treats the matrix result, the human decision, and the authority check as one blob.

## Week 3 — The matrix, slowly (days 15–21)

This week is the doctrinal heart. Code starts only for the lookup, and only after you can explain the cells.

- **Day 15.** ATP 5-19 paragraphs 1-33 through 1-38. Define frequent, likely, occasional, seldom, and unlikely without using the exposure examples as a formula.
- **Day 16.** Paragraphs 1-39 through 1-43 and Table 1-2. Define the four severities. Notice severity does not consider probability.
- **Day 17.** Paragraph 1-45. Write the three extremely high combinations and the paragraph number beside each.
- **Day 18.** Paragraph 1-46. Write the five high combinations.
- **Day 19.** Paragraphs 1-47 and 1-48. Write the medium and low combinations. Check that you have twenty and that each pair appears once.
- **Day 20.** If the twenty cells are solid, create the smallest Node and TypeScript setup that holds the twenty rows and tests them. The test name should include the paragraph. If the cells are not solid, spend the hour on the cells and move this build to day 21.
- **Day 21.** Finish the lookup test or, if it already passes, explain initial versus residual: residual is the same lookup after new estimates, not a discount. Read ATP 5-19 paragraphs 1-44 and 1-49.

## Week 4 — Estimates, decisions, and authority (days 22–28)

- **Day 22.** Read ATP 5-19 paragraphs 1-50 and 1-59. List the two control vocabularies, including AR 385-10 paragraph 6-5, and what, who, and how.
- **Day 23.** Read DA Pam 385-30 paragraphs 4-4 and 4-5 in the PDF, not only these notes. Mark sentences you personally see about duration and about overall residual risk.
- **Day 24.** Open Table 4-1 in the PDF. Transcribe only cells you can read without guessing. Leave medium, low, and delegation blank. Write “unverified” in those blanks.
- **Day 25.** On paper, separate three forms: matrix result, accept or reject, authority allowed or blocked. Use the Shop 2 story. Choose one extremely high example and show a blocked acceptance. Do not invent a general-officer override.
- **Day 26.** Add SQLite tables for organization, user, inspection, observation, and finding only if days 22–25 are clear. Seed Camp Sentinel with synthetic names. If they are not clear, stay on paper.
- **Day 27.** Add hazard and risk-assessment tables. The route that creates an assessment accepts probability and severity and returns the lookup. It rejects a client-supplied level.
- **Day 28.** Add risk-decision and authority-check tables. Unverified cells block. Write one test that a blocked decision does not change `matrix_level`.

## Week 5 — Close the loop (days 29–35)

- **Day 29.** Add corrective-action create and assign. Link the action to the finding and the hazard.
- **Day 30.** Add evidence metadata (name and hash are enough) and verification. Reject self-verification in a test.
- **Day 31.** Close the action. Read the finding back and show that `original_text` matches the inspection day.
- **Day 32.** A thin React page that can walk the same steps, or a rest day on the API if the page would crowd the hour. The API is the milestone. The page is optional until the API is explainable.
- **Day 33.** Run the full Shop 2 story from a clean database. Write down each record id in order.
- **Day 34.** Explain the story out loud in under ten minutes: doctrine paragraph, matrix cell, human decision, authority block or allow, and the unchanged finding.
- **Day 35.** Fix one misunderstanding you found on day 34. Do not add a new module.

## Week 6 — Hold the line (days 36–42)

- **Day 36.** Re-read DA Pam 385-10 paragraph 2-3d and compare it with your inspection and employee-report behavior. Note one gap you would fix later. Do not fix it today unless it is a defect in the milestone.
- **Day 37.** Re-read the three risk facts in the workflow note against your tables. Remove any column or button that can set a level by hand, if one appeared.
- **Day 38.** Write a short “how to demo” page for yourself: the Shop 2 clicks or requests, and the sentence that this is not an official assessment.
- **Day 39.** List tests you have. Add one if a rule you can explain has no test. Likely candidates: one matrix cell, one blocked authority check, one rejected self-verification.
- **Day 40.** Orientation only. Read the environmental chapter list in the [traceability matrix](04-traceability-matrix.md) and the AR 200-1 entry in the source register. Write which programs you would attach to a finding later, and why permits differ by installation.
- **Day 41.** Orientation only. Read AR 385-10 chapter 7 paragraphs 7-1 and 7-2, and the occupational-health limits in the [security note](09-security-ai-governance.md). Write the line between a headcount and a medical record.
- **Day 42.** Orientation only. Read the AI section of the security note. Write what the server would send to Grok and what it would refuse to let Grok change. Stop. The next build, after this program, can start with environment or with the AI shell. It starts from a workflow you can already defend.

## After day 42

A later block, still at about one hour a day, can add one capability at a time: environmental obligations on the same finding and action records; exposure-group counts; a council page that only counts records you already trust; ASOHMS placeholder rows that say they are not official; then Grok through the server. Official criteria are loaded only from a controlled source, and even then the screen says SENTINEL is not the Army’s assessor.

## Working agreement for every coding day

- One doctrinal idea, then the smallest code that makes that idea true.
- No package that the architecture note does not name.
- No override, waiver, or delegation feature.
- No invented mishap class, RAC exception, or ASOHMS criterion sentence.
- When a PDF and these notes disagree, the PDF wins, and the source register gets a correction.
