import "dotenv/config";

import { config } from "../env.js";

const {
  DB_HOST = "localhost",
  DB_PORT = "5432",
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
} = config;

if (!DB_NAME) throw new Error("DB_NAME is required");

if (!DB_USER) throw new Error("DB_USER is required");

if (!DB_PASSWORD) throw new Error("DB_PASSWORD is required");

const database = encodeURIComponent(DB_NAME);

const user = encodeURIComponent(DB_USER);

const password = encodeURIComponent(DB_PASSWORD);

export const databaseUrl = `postgresql://${user}:${password}@${DB_HOST}:${DB_PORT}/${database}?schema=public`;
