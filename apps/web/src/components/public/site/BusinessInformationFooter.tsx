import type { BusinessInformation } from "@event-management/contracts/business-information";
import { Brand } from "@event-management/ui";
import {
  businessInformationIsEmpty,
  telHref,
} from "../../../lib/utils/business-information/display";
import { BUSINESS_INFORMATION_FIELD_LABELS } from "../../../lib/utils/business-information/field-labels";

const DEFAULT_TAGLINE =
  "Thoughtful event planning and calm coordination, from first idea to final update.";

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} rel="noopener noreferrer" target="_blank">
      {children}
    </a>
  );
}

function trimValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

function hasPublicInformation(
  information: BusinessInformation | null,
): information is BusinessInformation {
  return information !== null && !businessInformationIsEmpty(information);
}

export function BusinessInformationFooter({
  information,
}: {
  information: BusinessInformation | null;
}) {
  const year = new Date().getFullYear();
  const showDetails = hasPublicInformation(information);

  const about = information?.about;
  const contact = information?.contact;
  const location = information?.location;
  const hours = information?.hours;

  const businessName = trimValue(about?.name);
  const introduction = trimValue(about?.introduction);
  const phone = trimValue(contact?.phone);
  const email = trimValue(contact?.email);
  const facebook = trimValue(contact?.facebook);
  const instagram = trimValue(contact?.instagram);
  const address = trimValue(location?.address);
  const mapUrl = trimValue(location?.mapUrl);
  const serviceAreas = trimValue(location?.serviceAreas);
  const supportHours = trimValue(hours?.supportHours);

  const phoneHref = phone ? telHref(phone) : null;

  const hasContact =
    showDetails && Boolean(phone || email || facebook || instagram);
  const hasLocation = showDetails && Boolean(address || mapUrl || serviceAreas);
  const hasHours = showDetails && Boolean(supportHours);
  const hasAboutCopy = showDetails && Boolean(businessName || introduction);

  return (
    <footer
      id="business-information"
      className="public-footer business-information-footer"
    >
      <section
        className="business-information-footer-details"
        aria-label="Business details"
      >
        <section
          className="business-information-footer-brand"
          aria-label="Business"
        >
          <Brand light />
          {hasAboutCopy ? (
            <>
              {businessName ? (
                <p className="business-information-footer-name">
                  {businessName}
                </p>
              ) : null}
              {introduction ? (
                <p className="business-information-footer-intro">
                  {introduction}
                </p>
              ) : null}
            </>
          ) : (
            <p className="business-information-footer-tagline">
              {DEFAULT_TAGLINE}
            </p>
          )}
        </section>

        {hasContact ? (
          <section
            className="business-information-footer-group"
            aria-labelledby="bi-footer-contact"
          >
            <h2 id="bi-footer-contact">Contact</h2>
            <address className="business-information-footer-contact">
              {phone ? (
                phoneHref ? (
                  <a href={phoneHref}>{phone}</a>
                ) : (
                  <span>{phone}</span>
                )
              ) : null}
              {email ? (
                <a href={`mailto:${encodeURIComponent(email)}`}>{email}</a>
              ) : null}
              {facebook || instagram ? (
                <nav
                  className="business-information-footer-social"
                  aria-label="Social profiles"
                >
                  {facebook ? (
                    <ExternalLink href={facebook}>
                      {BUSINESS_INFORMATION_FIELD_LABELS.contact.facebook}
                    </ExternalLink>
                  ) : null}
                  {instagram ? (
                    <ExternalLink href={instagram}>
                      {BUSINESS_INFORMATION_FIELD_LABELS.contact.instagram}
                    </ExternalLink>
                  ) : null}
                </nav>
              ) : null}
            </address>
          </section>
        ) : null}

        {hasLocation ? (
          <section
            className="business-information-footer-group"
            aria-labelledby="bi-footer-location"
          >
            <h2 id="bi-footer-location">Location</h2>
            {address ? (
              <p className="business-information-footer-address">{address}</p>
            ) : null}
            {mapUrl ? (
              <p>
                <ExternalLink href={mapUrl}>View on map</ExternalLink>
              </p>
            ) : null}
            {serviceAreas ? (
              <p className="business-information-footer-areas">
                {serviceAreas}
              </p>
            ) : null}
          </section>
        ) : null}

        {hasHours ? (
          <section
            className="business-information-footer-group"
            aria-labelledby="bi-footer-hours"
          >
            <h2 id="bi-footer-hours">Opening hours</h2>
            <p className="business-information-footer-hours">{supportHours}</p>
          </section>
        ) : null}
      </section>
      <section
        className="business-information-footer-bottom"
        aria-label="Site information"
      >
        <nav className="business-information-footer-nav" aria-label="Footer">
          <a href="/packages">Packages</a>
          <a href="/services">Services</a>
        </nav>

        <small className="business-information-footer-copy">
          © {year} Styled by AMAC
        </small>
      </section>
    </footer>
  );
}
