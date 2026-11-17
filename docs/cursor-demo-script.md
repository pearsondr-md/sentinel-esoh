# Cursor demo script

Twelve minutes. The audience is a Cursor interviewer. The garrison screen is proof the product can be built. The demo is the playbook: read the current behavior, make a small change inside the lane, refuse a change that leaves the lane, then review the diff.

Open the Agents window, not a tour of the app. The files you will show are already in the repo:

- `.cursor/agents/doctrine-reader.md` reads and does not edit.
- `.cursor/agents/security-reviewer.md` checks a diff and does not edit.
- `.cursor/hooks.json` and `.cursor/hooks/protect-doctrine.mjs` stop an agent from editing `server/src/doctrine.ts`, from removing `finding_original_text_immutable`, and from rewriting finding text in the shell.

Before the room: `cd server && npm test` is green. The app is running. You are signed in. Overview is already on screen. Hooks are enabled for this project (Cursor Settings, Hooks). If a hook was added in this session, reload the window once so `hooks.json` is picked up.

Say this once, then stop explaining the domain:

> This is a working record system. The interview is not the records. The interview is how a developer is allowed to change it.

## 1. The work is already loaded (about one minute)

Stay on Overview. One overdue record is on screen. Open Ask. Paste:

> What is overdue in my account?

When the reply lands:

> That answer came from the records this account can open. The reply is text. It cannot accept the risk, assign the action, or close the record.

Do not click into the shop, the tile, or the container. If they ask what the overdue item is, read the one sentence on screen and come back.

## 2. Characterize before anyone changes it (about three minutes)

New agent chat. Paste:

> Use the doctrine-reader subagent. Explain how a typed matrix level is handled, how original finding text is protected, and how a blocked authority check leaves the matrix cell. Do not edit anything. Name the tests that record this behavior.

Let it run. Open the subagent file while it reads, and say:

> I called this agent by name. Its file says read only. Its job is to say what the code does today. The tests it names are the characterization. They freeze current behavior. They do not grade it.

When it answers, open one cited test in `server/src/workflow.test.ts` and leave it visible. You want the room to see a named agent, a file that forbids edits, and a test that already locks the behavior.

If the subagent starts proposing a patch, stop it and point at `readonly: true` in the frontmatter. That is the miss, and it is still the point.

## 3. A change inside the lane (about three minutes)

New agent chat. This one is the parent agent, not the reader. Paste:

> In `client/src/Ask.tsx`, change the commander suggestion "What is waiting for my decision?" to "What is waiting for me to decide?" Leave server code, doctrine, and tests alone.

Let it edit. Open the diff.

> This is an allowed change. Copy on the client. The doctrine file was not in the request, and the hook would have stopped an edit there anyway.

Run, in the terminal they can see:

```bash
cd server && npx tsx --test src/workflow.test.ts
```

> The characterization tests still pass. The words on the screen moved. The lookup, the trigger, and the authority check did not.

Leave the diff uncommitted. The next two beats use it.

## 4. A change the agent may not make (about three minutes)

Same chat, or a new one. Paste:

> Update `server/src/doctrine.ts` so an O-5 can accept extremely high risk.

The hook denies the write. Read the refusal out loud. Then open `.cursor/hooks/protect-doctrine.mjs` and show the `doctrine.ts` deny.

> I can still edit that file myself. The hook binds the agent. The playbook is the same for a tired afternoon and a new hire: this file is a person's edit.

If the model only talks about the change and never calls the write tool, say: "Make the edit in `server/src/doctrine.ts` now." The denial is the beat. A paragraph about why the change is unwise is not the beat.

Optional second denial, if they want to see the shell path. Paste:

> Run sqlite and update finding set original_text to a rewrite.

The same hook denies the command. One denial is enough if the clock is short.

## 5. Review the change that was allowed (about two minutes)

Paste:

> Use the security-reviewer subagent on the uncommitted diff. Report whether doctrine, the original-text trigger, camp isolation, or the question route's write boundary moved. Do not edit files.

When it reports:

> Reader, then change, then refusal, then review. Same order every time. The agents are the playbook. The hook is the part that does not depend on the model agreeing.

## If they leave the script

Answer from the files, then return to the diff.

- "Show me it build something." The Ask copy change is that. Point at the diff. Offer one more client sentence if they want a second edit. Do not open a new feature.
- "What if the doctrine is wrong?" A person edits `server/src/doctrine.ts`, then the characterization tests are rewritten on purpose and re-run. The agent does not get that file.
- "How do you know the model behaved?" The hook denial is deterministic. The reviewer reads the diff. The test run is the characterization still holding.
- "Can you connect this to Jira?" The overdue list is the same shape as a ticket queue: the work is loaded, the agent answers from those rows, and a separate control decides what the agent is allowed to change.

## What you leave on screen

The uncommitted Ask copy diff, the denied doctrine edit in the transcript, and `protect-doctrine.mjs`. That is the whole story: change is allowed, governance runs even when the model is willing.
