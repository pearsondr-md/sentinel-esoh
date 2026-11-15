import { createApp } from "./app.ts";
import { defaultDbPath } from "./db.ts";

const { app } = createApp(defaultDbPath());
const port = 3000;

app.listen(port, () => {
  console.log(`listening on ${port}`);
});
