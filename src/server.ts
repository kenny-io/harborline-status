/** Local Harborline server entrypoint; production hosts may embed createHarborlineApp. */

import { serve } from "@hono/node-server";
import { createHarborlineApp } from "./app.js";
import { createHarborlineStore } from "./store.js";

const port = Number.parseInt(process.env.PORT ?? "3417", 10);
const app = createHarborlineApp({
  store: createHarborlineStore(),
  apiToken: process.env.HARBORLINE_API_TOKEN,
});

serve({ fetch: app.fetch, port });
process.stdout.write(`Harborline listening on http://localhost:${port}\n`);
