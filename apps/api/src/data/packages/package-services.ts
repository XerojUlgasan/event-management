import type { Kysely, Transaction } from "kysely";
import type { PackageServiceInput } from "@event-management/contracts/catalog";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export type PackageServiceRow = {
  package_id: string;
  service_id: string;
  role: string;
  sort_order: number;
  name: string;
  archived_at: Date | null;
};

export function listPackageServicesData(
  db: Database,
  packageIds: string[],
): Promise<PackageServiceRow[]> {
  if (!packageIds.length) return Promise.resolve([]);
  return db
    .selectFrom("package_services as ps")
    .innerJoin("services as s", "s.id", "ps.service_id")
    .select([
      "ps.package_id",
      "ps.service_id",
      "ps.role",
      "ps.sort_order",
      "s.name",
      "s.archived_at",
    ])
    .where("ps.package_id", "in", packageIds)
    .orderBy("ps.package_id")
    .orderBy("ps.sort_order")
    .execute();
}

export type PackageServiceError = { message: string; status: 400 };

export async function validatePackageServicesData(
  db: Transaction<DB>,
  packageId: string | null,
  services: PackageServiceInput[],
): Promise<PackageServiceError | null> {
  if (!services.length) return null;
  const ids = services.map((service) => service.serviceId);
  const rows = await db
    .selectFrom("services")
    .select(["id", "archived_at"])
    .where("id", "in", ids)
    .orderBy("id")
    .forUpdate()
    .execute();
  const found = new Map(rows.map((row) => [row.id, row]));
  if (ids.some((id) => !found.has(id)))
    return {
      message: "One or more services no longer exist. Refresh and try again",
      status: 400,
    };

  // Archived services keep their existing assignment but cannot be added.
  let previouslyAssigned = new Set<string>();
  if (packageId) {
    const current = await db
      .selectFrom("package_services")
      .select("service_id")
      .where("package_id", "=", packageId)
      .execute();
    previouslyAssigned = new Set(current.map((row) => row.service_id));
  }
  if (
    services.some(
      (service) =>
        found.get(service.serviceId)!.archived_at !== null &&
        !previouslyAssigned.has(service.serviceId),
    )
  )
    return {
      message: "Archived services cannot be added to a package",
      status: 400,
    };

  return null;
}

export async function replacePackageServicesData(
  db: Transaction<DB>,
  packageId: string,
  services: PackageServiceInput[],
) {
  await db
    .deleteFrom("package_services")
    .where("package_id", "=", packageId)
    .execute();
  if (!services.length) return;
  await db
    .insertInto("package_services")
    .values(
      services.map((service, index) => ({
        package_id: packageId,
        service_id: service.serviceId,
        role: service.role,
        sort_order: index,
      })),
    )
    .execute();
}
