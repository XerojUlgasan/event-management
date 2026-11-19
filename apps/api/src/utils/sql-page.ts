import { sql, type RawBuilder } from "kysely";

const IDENTIFIER = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/;

function columnRef(column: string) {
  if (!IDENTIFIER.test(column))
    throw new Error(`Invalid SQL column reference: ${column}`);

  return sql.raw(
    column
      .split(".")
      .map((part) => `"${part}"`)
      .join("."),
  );
}

/** Microsecond UTC text. Postgres date parsing drops these microseconds. */
export function utcTimestampSql(column: string): RawBuilder<string> {
  return sql<string>`to_char(${columnRef(column)} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

export function keysetPredicate(
  timestampColumn: string,
  idColumn: string,
  timestamp: string,
  id: string,
  direction: "<" | ">",
): RawBuilder<boolean> {
  return sql<boolean>`(${columnRef(timestampColumn)}, ${columnRef(idColumn)}) ${sql.raw(direction)} (${timestamp}::timestamptz, ${id}::uuid)`;
}

export function catalogTextMatch(search: string): RawBuilder<boolean> {
  return sql<boolean>`strpos(lower(name || ' ' || description), lower(${search})) > 0`;
}
