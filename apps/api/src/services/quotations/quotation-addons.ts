import { reviewedServiceSchema } from "@event-management/contracts/booking-draft";
import { storedSectionsSchema } from "@event-management/contracts/catalog-canvas";
import { pesosToCentavos } from "@event-management/contracts/money";
import {
  calculateQuotationAddonAmount,
  type QuotationAddonItem,
} from "@event-management/contracts/quotations";
import type { Selectable, Transaction } from "kysely";
import { quotationServicesData } from "../../data/quotations/quotation-services.js";
import type { BookingRequests, DB, Packages } from "../../db/types.js";
import { canvasServiceIds } from "../../utils/catalog-canvas.js";

export async function quotationAddons(
  trx: Transaction<DB>,
  booking: Pick<Selectable<BookingRequests>, "requested_services">,
  pkg: Pick<Selectable<Packages>, "id" | "canvas">,
  lock: boolean,
) {
  const addons = reviewedServiceSchema
    .array()
    .parse(booking.requested_services ?? [])
    .flatMap(({ offer, id, serviceId, name }) =>
      offer && id && serviceId ? [{ offer, id, serviceId, name }] : [],
    );

  if (!addons.length) return [];

  const services = await quotationServicesData(
    trx,
    addons.map(({ serviceId }) => serviceId),
    lock,
  );

  const byId = new Map(services.map((service) => [service.id, service]));

  const included = canvasServiceIds(storedSectionsSchema.parse(pkg.canvas));

  return addons.map(({ id, serviceId, name, offer }) => {
    const service = byId.get(serviceId);
    const { totalHours, includedHours, fixedPricePesos, hourlyRatePesos } =
      offer;
    const hours =
      totalHours === null
        ? null
        : Math.max(0, totalHours - (includedHours ?? 0));
    const unavailable = !service || service.archived_at;
    const requiresRemoval = unavailable
      ? "archived"
      : included.has(serviceId)
        ? "included"
        : undefined;
    const addon: QuotationAddonItem["addon"] = {
      source: {
        packageId: pkg.id,
        addonId: id,
        fixedPriceMinor:
          fixedPricePesos === null ? null : pesosToCentavos(fixedPricePesos),
        hourlyRateMinor: pesosToCentavos(hourlyRatePesos),
        includedHours,
      },
      fixedPriceOverrideMinor: null,
      hourlyRateOverrideMinor: null,
      hours,
      totalHours,
      ...(requiresRemoval ? { requiresRemoval } : {}),
    };
    const item: QuotationAddonItem = {
      id,
      direction: "add",
      kind: "addition",
      description: name,
      serviceId,
      amountMinor:
        totalHours === null
          ? null
          : calculateQuotationAddonAmount(addon).amountMinor,
      addon,
    };

    return item;
  });
}
