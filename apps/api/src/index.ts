import "dotenv/config";
import { serve } from "@hono/node-server";
import { config } from "./env.js";
import { app } from "./app.js";

const { API_PORT = "3000" } = config;

const port = Number(API_PORT);

serve({ fetch: app.fetch, port }, (address) => {
  console.log(`API listening on http://localhost:${address.port}`);
});
