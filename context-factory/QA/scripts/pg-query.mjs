#!/usr/bin/env node
import { createClient } from "./config.mjs";

const usage = 'Usage: node context-factory/QA/scripts/pg-query.mjs SQL [JSON_PARAMETERS]\nUse - for SQL on stdin. Queries run in a read-only transaction.';

async function main() {
  const [input, encodedParams = "[]", ...extra] = process.argv.slice(2);
  if (input === "--help") return console.log(usage);
  if (!input || extra.length) throw new Error(usage);
  let statement = input;
  if (input === "-") {
    statement = "";
    for await (const chunk of process.stdin) statement += chunk.toString();
  }
  if (!statement.trim()) throw new Error("SQL must not be empty.");
  const params = JSON.parse(encodedParams);
  if (!Array.isArray(params)) throw new Error("Parameters must be a JSON array.");

  const client = createClient();
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    try {
      // Extended protocol rejects multiple statements, including transaction escapes.
      const result = await client.query({ text: statement, values: params, queryMode: "extended" });
      console.log(JSON.stringify({ command: result.command, rowCount: result.rowCount, rows: result.rows }, null, 2));
    } finally {
      await client.query("ROLLBACK");
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`${error.code ? `${error.code}: ` : ""}${error.message}`);
  process.exitCode = 1;
});
