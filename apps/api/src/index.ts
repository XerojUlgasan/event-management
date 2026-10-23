import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./app.js";

const port = Number(process.env.API_PORT ?? 3000);

serve({ fetch: app.fetch, port }, (address) => {
  console.log(`API listening on http://localhost:${address.port}`);
});
