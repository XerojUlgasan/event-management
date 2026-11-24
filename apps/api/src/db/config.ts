import "dotenv/config";

import { config } from "../env.js";

const host = config.DB_HOST;
const port = config.DB_PORT;

const database = encodeURIComponent(config.DB_NAME);

const user = encodeURIComponent(config.DB_USER);

const password = encodeURIComponent(config.DB_PASSWORD);

export const databaseUrl = `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`;
