import "../../styles/booking-requests/booking-intake.css";
import type { ReviewedBookingService } from "@event-management/contracts/booking-draft";
import { servicePricingLabels } from "../../lib/utils/formatting/money";

export function BookingIntake({
  requestedServices = [],
  budget,
}: {
  requestedServices: ReviewedBookingService[];
  budget: string | null;
}) {
  if (!requestedServices.length && !budget) return null;

  return (
    <section className="booking-intake">
      <h4>Additional requests</h4>
      {requestedServices.length > 0 && (
        <ul>
          {requestedServices.map((service, index) => (
            <li key={`${service.serviceId ?? service.name}-${index}`}>
              {service.name}
              {service.included ? " (included in package)" : ""}
              {service.hours != null
                ? ` · ${service.hours} hours requested`
                : ""}
              {service.catalogPricing && service.hours != null && (
                <>
                  {service.catalogPricing.includedHours != null &&
                    ` · ${Math.max(0, service.hours - service.catalogPricing.includedHours)} excess hours`}
                  {` · Indicative catalog terms: ${servicePricingLabels(service.catalogPricing).price}`}
                  {servicePricingLabels(service.catalogPricing).excess &&
                    `; ${servicePricingLabels(service.catalogPricing).excess}`}
                </>
              )}
              {service.notes ? ` · ${service.notes}` : ""}
            </li>
          ))}
        </ul>
      )}
      {budget && (
        <p>
          <strong>Budget:</strong> {budget}
        </p>
      )}
      <p>Additional services are requests for team review.</p>
    </section>
  );
}
