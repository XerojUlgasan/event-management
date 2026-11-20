import { storedSectionsSchema } from "@event-management/contracts/catalog-canvas";
import { packageAddonServicesSchema } from "@event-management/contracts/catalog-service-terms";
import { pesosToCentavos } from "@event-management/contracts/money";
import {
  calculateQuotationAddonAmount,
  type QuotationAddonItem,
  type QuotationItem,
} from "@event-management/contracts/quotations";
import type { Selectable, Transaction } from "kysely";
import { quotationServicesData } from "../../data/quotations/quotation-services.js";
import type { DB, Packages } from "../../db/types.js";
import { canvasServiceIds } from "../../utils/catalog-canvas.js";

export function withQuotationAddonHours(
  item: QuotationAddonItem,
  hours: number | null,
): QuotationAddonItem {
  const addon = { ...item.addon, hours };

  return {
    ...item,
    addon,
    amountMinor: calculateQuotationAddonAmount(addon).amountMinor,
  };
}

type AddonPackage = Pick<
  Selectable<Packages>,
  "id" | "package_type" | "addon_services" | "canvas"
>;

export async function quotationAddons(
  trx: Transaction<DB>,
  pkg: AddonPackage,
  lock: boolean,
  previousItems: QuotationItem[] = [],
): Promise<QuotationAddonItem[]> {
  if (pkg.package_type !== "custom") return [];

  const addons = packageAddonServicesSchema.parse(pkg.addon_services);

  if (!addons.length) return [];

  const services = await quotationServicesData(
    trx,
    addons.map((addon) => addon.serviceId),
    lock,
  );

  const byId = new Map(services.map((service) => [service.id, service]));

  const included = canvasServiceIds(storedSectionsSchema.parse(pkg.canvas));

  const previous = new Map(
    previousItems.flatMap((item) =>
      item.addon?.source.packageId === pkg.id
        ? [[item.addon.source.addonId.toLowerCase(), item.addon] as const]
        : [],
    ),
  );

  return addons.map((addon) => {
    const serviceId = addon.serviceId.toLowerCase();
    const id = addon.id.toLowerCase();
    const service = byId.get(serviceId);
    const historical = previous.get(id);
    const hourly = addon.includedHours === null;
    const hours =
      historical && (historical.source.includedHours === null) === hourly
        ? historical.hours
        : hourly
          ? null
          : 0;
    const requiresRemoval =
      !service || service.archived_at
        ? "archived"
        : included.has(serviceId)
          ? "included"
          : undefined;
    const item: QuotationAddonItem = {
      id,
      direction: "add",
      kind: "addition",
      description: service?.name ?? "Unavailable add-on service",
      serviceId,
      amountMinor: null,
      addon: {
        source: {
          packageId: pkg.id,
          addonId: id,
          fixedPriceMinor:
            addon.fixedPricePesos === null
              ? null
              : pesosToCentavos(addon.fixedPricePesos),
          hourlyRateMinor: pesosToCentavos(addon.hourlyRatePesos),
          includedHours: addon.includedHours,
        },
        fixedPriceOverrideMinor: null,
        hourlyRateOverrideMinor: null,
        hours,
        ...(requiresRemoval ? { requiresRemoval } : {}),
      },
    };

    return withQuotationAddonHours(item, hours);
  });
}
