import type { Pool } from "pg";

/** Close the caller's test pools first; PostgreSQL may still be closing sockets
 * after pg-pool resolves end(). Never force-disconnect another session. */
export async function dropTestDatabase(admin: Pool, database: string) {
  if (!/^em_[a-z_]+_[0-9a-f]{32}$/.test(database)) {
    throw new Error("Refusing to drop a database without a valid test identifier");
  }
  const deadline = Date.now() + 5000;
  while (true) {
    const active = await admin.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM pg_stat_activity WHERE datname = $1",
      [database],
    );
    if (active.rows[0]?.count === "0") break;
    if (Date.now() >= deadline) throw new Error(`Test database connections did not close: ${database}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
}
