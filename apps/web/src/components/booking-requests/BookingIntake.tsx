import "../../styles/booking-requests/booking-intake.css";
import type { BookingService } from "../../lib/data/booking-requests/requests";
import {
  bookingHoursLabel,
  bookingOfferAmountLabel,
} from "../../lib/utils/formatting/money";

export function BookingIntake({
  requestedServices = [],
  budget,
}: {
  requestedServices: BookingService[];
  budget: string | null;
}) {
  const services = requestedServices.filter((service) => {
    if (service.offer) return true;

    if (service.included || service.origin === "admin") return false;

    return true;
  });

  if (!services.length && !budget) return null;

  return (
    <section className="service-summary">
      {services.length > 0 && (
        <>
          <h4>Services</h4>
          <ul>
            {services.map((service, index) => {
              const hours = service.offer?.totalHours ?? service.hours;
              const amount = service.offer
                ? bookingOfferAmountLabel(service.offer)
                : null;

              return (
                <li key={service.id ?? `${service.name}-${index}`}>
                  <div>
                    <strong>{service.name}</strong>
                    <span>
                      {bookingHoursLabel(hours)}
                      {service.offer ? "" : " · For review"}
                    </span>
                    {service.notes && <small>{service.notes}</small>}
                  </div>
                  {amount && <b>{amount}</b>}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {budget && (
        <p>
          <span>Budget</span>
          {budget}
        </p>
      )}
    </section>
  );
}
