import "dotenv/config";

import { env } from "../utils/env.js";

const host = env.DB_HOST;
const port = env.DB_PORT;

const database = encodeURIComponent(env.DB_NAME);

const user = encodeURIComponent(env.DB_USER);

const password = encodeURIComponent(env.DB_PASSWORD);

export const databaseUrl = `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`;
