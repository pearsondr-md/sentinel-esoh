# 42-day roadmap

About **one hour a day**, for 42 days. Each day practices a Cursor or Grok skill. Army doctrine is read only for the rule that day's work must follow. If the hour is full, stop. Do not add a second feature.

The research notes in this folder stay the reference. You do not reread them from front to back before using the editor.

The only working software milestone inside these 42 days is:

**Inspection → finding → hazard → risk assessment → corrective action → verification.**

Environmental compliance, occupational health, executive analytics, and a live Grok API call come after day 42. Days 40–42 practice asking Grok to sketch those modules, then stopping the sketch when it breaks a rule in the notes.

Stack, when code starts: React, TypeScript, Tailwind, Vite, Node, Express, SQLite, and Git. No extra infrastructure.

## How a day works

1. Open Cursor on this repository.
2. Do the tool skill for about 40 minutes.
3. Spend the last few minutes checking one rule: Did Grok invent a criterion, a risk level, an override, or a module that is not today's work? If it did, reject that part.
4. Leave a few sentences in `docs/learning/` for that day. Your words, not a paste of the whole chat.

Grok drafts. You accept only what you can explain.

## Week 1 — Cursor is the workspace (days 1–7)

Doctrine this week is one idea: documents have layers, and a pamphlet is not a statute. The practice is writing and reviewing that idea in Cursor.

- **Day 1.** Open this repo in Cursor. Start a chat and attach [the baseline](01-doctrine-baseline.md) with an @ mention. Write five sentences in `docs/learning/day-01.md`, each using a different authority layer. Ask Grok to review them. Keep a sentence only if it still matches the note.
- **Day 2.** Ask Grok to tighten `day-01.md`. Read the diff. Accept or reject each change. Reject any change that calls ATP 5-19 a federal regulation or calls DA Pam 385-10 a statute.
- **Day 3.** Ask Grok what it would build next. Compare the answer to the milestone at the top of this file. Practice answering no to environmental screens, occupational health, and an AI feature.
- **Day 4.** Use the terminal in Cursor. Run `git status` and `git diff`. Say what is changed and what is not. No commit is required.
- **Day 5.** Write a commit message yourself. You may ask Grok for a draft, then edit it. Commit only the learning note if you want the notes in git.
- **Day 6.** At the start of a new chat, state the standing limits in your own words: synthetic data, no invented ASOHMS criteria, no hand-typed risk level, no extra modules. Ask a question and see whether the answer obeys them.
- **Day 7.** Ask Grok to explain [the workflow](08-workflow.md). Correct one mistake. The mistake to look for is merging the matrix result, the human decision, and the authority check into one step.

## Week 2 — The smallest app, reviewed file by file (days 8–14)

Doctrine this week is the record chain: a finding's original text stays, and one unit does not read another's drafts. Read those parts of the [data model](07-data-model.md) only when you create the type or the test.

- **Day 8.** Scaffold `client` (Vite, React, TypeScript, Tailwind) and `server` (Express, TypeScript). Before you continue, name each dependency in `package.json` and what it does. Remove any dependency you cannot explain.
- **Day 9.** Add a health route. Run the server from the terminal and request it. If it fails, paste the error to Grok, then read the suggested fix before you apply it.
- **Day 10.** Add a shared TypeScript type for a finding. Include `originalText`. Ask Grok to add an update function that rewrites that field. Reject that function.
- **Day 11.** Add a SQLite `organization` table and a Camp Sentinel seed. The seed is fictional. Ask Grok where the database file lives, and confirm it is not committed with secrets.
- **Day 12.** Add users, roles, and one test: a token for one unit cannot list another unit's records. Run the test. Read the assertion out loud.
- **Day 13.** Ask Grok to add an environmental module. Reject it. The point is scope control in the diff.
- **Day 14.** Explain the folders out loud: browser, server, shared types, SQLite. Rename one confusing file if you cannot explain it.

## Week 3 — The risk matrix, with the paragraph open (days 15–21)

Open ATP 5-19 only for the paragraphs named that day. Grok may draft a test. You check the cell against the paragraph before the test is allowed to pass.

- **Day 15.** Read ATP 5-19 paragraphs 1-33 through 1-38. Add probability codes A–E as data, with the paragraph number in a comment. The “about 500 exposures” sentence is an example, not a formula. Reject code that calculates probability from an exposure count.
- **Day 16.** Read paragraphs 1-39 through 1-43 and Table 1-2. Add severity codes I–IV the same way.
- **Day 17.** Read paragraph 1-45. Encode the three extremely high cells: IA, IB, IIA. One test per cell, named with the paragraph.
- **Day 18.** Read paragraph 1-46. Encode the five high cells: IC, ID, IIB, IIC, IIIA.
- **Day 19.** Read paragraphs 1-47 and 1-48. Encode medium and low. Confirm there are twenty cells and each pair appears once.
- **Day 20.** Run the full lookup test. If Grok has introduced a 1-to-5 score, take it out.
- **Day 21.** Read paragraphs 1-44 and 1-49. Store initial and residual as two lookups. Residual uses new probability and severity. It is not a percent discount and not a typed-in level.

## Week 4 — The path through the server (days 22–28)

- **Day 22.** Inspection, observation, and finding routes. One test creates a finding and reads `originalText` back.
- **Day 23.** Link a hazard to the finding. Ask Grok what happens to the hazard when the finding is later closed. The answer you keep: the hazard remains.
- **Day 24.** Assessment route. The body may send probability and severity. The server writes `matrixLevel`. A test sends a client-supplied level and proves it is ignored.
- **Day 25.** Read the three risk facts in the [workflow](08-workflow.md). Add `risk_decision` and `authority_check`. Unverified authority cells block. A blocked decision does not change `matrixLevel`.
- **Day 26.** Ask Grok for an override flag so a supervisor can accept extremely high risk. Refuse it. Add a test that the field is absent.
- **Day 27.** Create and assign a corrective action linked to the finding and the hazard.
- **Day 28.** Walk the Shop 2 story through the API. Write down each record id in order.

## Week 5 — Verification, then a thin page (days 29–35)

- **Day 29.** Verification. The server rejects a verification from the user who completed the action. One test.
- **Day 30.** Close the action. Read the finding again. `originalText` matches the inspection day.
- **Day 31.** One React screen for creating an inspection and a finding. Ask Grok to explain the state and the fetch in this screen only.
- **Day 32.** Add the assessment step to that screen. The level shown is the server's lookup. The form has no level dropdown.
- **Day 33.** Run the Shop 2 story from a clean database through the screen or the API, whichever you can explain.
- **Day 34.** Ten-minute narration: paragraph, matrix cell, human decision, authority block or allow, unchanged finding.
- **Day 35.** Fix one bug. Paste the error to Grok. Apply a fix only if you can explain it.

## Week 6 — Judgment (days 36–42)

- **Day 36.** Read DA Pam 385-10 paragraph 2-3d only. Compare it with your inspection and employee report. Write one gap to fix later. Do not build it today.
- **Day 37.** Search the project for override, a client-supplied risk level, and any invented “criterion 1 of 48.” Remove what you find.
- **Day 38.** Ask Grok to draft a demo script. Delete any sentence that says SENTINEL produced an official Army assessment or an Army SOH Star.
- **Day 39.** Add one test for a rule you can already explain and that has no test yet.
- **Day 40.** Ask Grok to design environmental tables. Edit the answer until those records attach to the finding and action you already have. Fifteen minutes in the [traceability matrix](04-traceability-matrix.md) is enough doctrine. Do not add the module.
- **Day 41.** Ask Grok to add a medical record. Stop that change. Read the occupational-health limits in the [security note](09-security-ai-governance.md).
- **Day 42.** Ask Grok how it would call the xAI API from this app. Keep the answer only if the call is from the server, the key stays off the client, and the model cannot write a risk level, an acceptance, or a closure. Do not install that call today.

## After day 42

Continue at about one hour a day, one capability at a time: environmental obligations on the same finding and action, exposure-group counts, a council page that only counts records you trust, ASOHMS placeholder rows that say they are not official, then Grok through the server. Official criteria are loaded only from a controlled source.

## Working agreement

- Grok drafts. You accept what you can explain.
- No package the architecture note does not name.
- No override, waiver, or delegation feature until a paragraph for it has been checked.
- No invented mishap class or ASOHMS criterion.
- When a PDF and these notes disagree, the PDF wins, and the source register gets a correction.
