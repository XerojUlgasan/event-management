import "dotenv/config";

import { config } from "../env.js";

const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = config;

if (!DB_HOST || !DB_PORT || !DB_NAME || !DB_USER || !DB_PASSWORD)
  throw new Error("Set DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD");

const database = encodeURIComponent(DB_NAME);

const user = encodeURIComponent(DB_USER);

const password = encodeURIComponent(DB_PASSWORD);

export const databaseUrl = `postgresql://${user}:${password}@${DB_HOST}:${DB_PORT}/${database}?schema=public`;
