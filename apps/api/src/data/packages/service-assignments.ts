import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { Content } from "../../controllers/packages/schemas.js";
import { serviceVersionDto } from "../../services/services/service-response.js";
type Database = Kysely<DB> | Transaction<DB>;
type Input = NonNullable<Content["services"]>;
export async function assignmentsData(db: Database, versionId: string) {
  const rows = await db
    .selectFrom("package_services")
    .selectAll()
    .where("package_version_id", "=", versionId)
    .orderBy("id")
    .execute();
  return Promise.all(
    rows.map(async (row) => {
      const service = await db
        .selectFrom("service_versions")
        .selectAll()
        .where("id", "=", row.service_version_id)
        .executeTakeFirstOrThrow();
      return {
        id: row.id,
        serviceVersionId: row.service_version_id,
        role: row.role as "included" | "add_on",
        includedQuantity: row.included_quantity,
        addOnPrice:
          row.add_on_unit_price_amount_minor === null
            ? null
            : {
                kind: "fixed" as const,
                currency: "PHP" as const,
                amountMinor: row.add_on_unit_price_amount_minor,
              },
        addOnMaxQuantity: row.add_on_max_quantity,
        service: serviceVersionDto(service),
      };
    }),
  );
}
export async function validateAssignmentsData(
  db: Transaction<DB>,
  input: Input,
) {
  const keys = input.map((x) => x.serviceVersionId);
  if (new Set(keys).size !== keys.length) return false;
  for (const id of [...new Set(input.map((x) => x.serviceVersionId))].sort()) {
    const version = await db
      .selectFrom("service_versions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    if (!version) return false;
    const service = await db
      .selectFrom("services")
      .selectAll()
      .where("id", "=", version.service_id)
      .forUpdate()
      .executeTakeFirst();
    const current = await db
      .selectFrom("service_versions")
      .select("state")
      .where("id", "=", id)
      .executeTakeFirst();
    if (!service || service.archived_at || current?.state !== "published")
      return false;
  }
  return true;
}
export async function replaceAssignmentsData(
  db: Transaction<DB>,
  versionId: string,
  input: Input,
) {
  const existing = await db
    .selectFrom("package_services")
    .selectAll()
    .where("package_version_id", "=", versionId)
    .execute();
  for (const row of existing)
    if (
      !input.some(
        (x) =>
          x.serviceVersionId === row.service_version_id && x.role === row.role,
      )
    )
      await db
        .deleteFrom("package_services")
        .where("id", "=", row.id)
        .execute();
  for (const x of input) {
    const values = {
      included_quantity: x.includedQuantity,
      add_on_unit_price_amount_minor: x.addOnPrice?.amountMinor ?? null,
      add_on_max_quantity: x.addOnMaxQuantity,
    };
    const row = existing.find(
      (r) => r.service_version_id === x.serviceVersionId && r.role === x.role,
    );
    if (row)
      await db
        .updateTable("package_services")
        .set(values)
        .where("id", "=", row.id)
        .execute();
    else
      await db
        .insertInto("package_services")
        .values({
          package_version_id: versionId,
          service_version_id: x.serviceVersionId,
          role: x.role,
          ...values,
        })
        .execute();
  }
}
