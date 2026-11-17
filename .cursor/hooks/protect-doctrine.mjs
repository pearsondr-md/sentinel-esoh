#!/usr/bin/env node
// Blocks agent writes to the doctrine table and agent attempts to rewrite a finding
// or drop the original-text trigger. A person can still edit those files by hand.

import { readFileSync } from "node:fs";

const raw = readFileSync(0, "utf8");
let input = {};
try {
  input = JSON.parse(raw || "{}");
} catch {
  process.stderr.write("protect-doctrine: stdin was not JSON\n");
  process.exit(2);
}

const tool = String(input.tool_name ?? input.toolName ?? "");
const toolInput = input.tool_input ?? input.toolInput ?? input.arguments ?? {};
const command = String(input.command ?? "");

function deny(userMessage, agentMessage) {
  process.stdout.write(
    JSON.stringify({
      permission: "deny",
      user_message: userMessage,
      agent_message: agentMessage,
    }),
  );
  process.exit(0);
}

function allow() {
  process.stdout.write(JSON.stringify({ permission: "allow" }));
  process.exit(0);
}

function pathOf(value) {
  return String(value ?? "").replaceAll("\\", "/");
}

const filePath = pathOf(toolInput.path ?? toolInput.file_path ?? toolInput.target_file);
const writeTool = /^(Write|StrReplace|Delete|EditNotebook|ApplyPatch)$/.test(tool);
const doctrineFile = /(?:^|\/)server\/src\/doctrine\.ts$/.test(filePath);
const schemaFile = /(?:^|\/)server\/src\/db\.ts$/.test(filePath);

if (writeTool && doctrineFile) {
  deny(
    "An agent cannot edit server/src/doctrine.ts. You can edit that file yourself. The matrix and the authority table stay with a person.",
    "Hook protect-doctrine denied this edit. server/src/doctrine.ts is reserved for a person. Do not retry the write. Say that the hook refused it and leave the file unchanged.",
  );
}

const contents = String(toolInput.contents ?? toolInput.content ?? "");
const oldText = String(toolInput.old_string ?? toolInput.oldString ?? "");
const newText = String(toolInput.new_string ?? toolInput.newString ?? "");
const triggerName = "finding_original_text_immutable";

if (writeTool && schemaFile) {
  const writeDropsTrigger = contents.length > 0 && !contents.includes(triggerName);
  const replaceDropsTrigger =
    (oldText.includes(triggerName) || oldText.includes("original_text is immutable")) &&
    !newText.includes(triggerName) &&
    !newText.includes("original_text is immutable");
  if (writeDropsTrigger || replaceDropsTrigger) {
    deny(
      "An agent cannot remove finding_original_text_immutable. You can edit the schema yourself. Finding text stays as first written.",
      "Hook protect-doctrine denied this edit. The original-text trigger must remain. Do not retry the write.",
    );
  }
}

const shell = command;
const rewritesFinding = /update\s+finding\s+set\s+original_text/i.test(shell);
const dropsTrigger = /drop\s+trigger\s+(if\s+exists\s+)?finding_original_text_immutable/i.test(shell);
const rewritesDoctrine =
  /server\/src\/doctrine\.ts/.test(shell) && /[>]|\btee\b|\brm\b|\bmv\b|\bsed\b|\bperl\b|\btruncate\b/.test(shell);

if (rewritesFinding || dropsTrigger || rewritesDoctrine) {
  deny(
    "An agent cannot rewrite finding text, drop the original-text trigger, or overwrite server/src/doctrine.ts from the shell.",
    "Hook protect-doctrine denied this command. Leave the doctrine file, the trigger, and finding text unchanged.",
  );
}

allow();
