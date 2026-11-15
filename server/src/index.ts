import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.ts";
import { defaultDbPath } from "./db.ts";

loadLocalKey();

const { app } = createApp(defaultDbPath());
const port = 3000;

app.listen(port, () => {
  console.log(`listening on ${port}`);
});

function loadLocalKey(): void {
  if (process.env.XAI_API_KEY) return;
  const path = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "xai.key");
  if (!existsSync(path)) return;
  const value = readFileSync(path, "utf8").trim();
  if (value) process.env.XAI_API_KEY = value;
}
