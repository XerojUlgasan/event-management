import "dotenv/config";

import { config } from "../env.js";

export const databaseUrl = config.SUPABASE_DB_URL?.trim();

if (!databaseUrl) throw new Error("SUPABASE_DB_URL is required");
