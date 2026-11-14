import { ActionLink } from "@event-management/ui";
import { useState } from "react";
import { Badge, Brand, Button, Dialog, Icon } from "@event-management/ui";

import { PackageCatalog } from "../../catalog/PackageCatalog";
import { PublicServiceCatalog } from "../../catalog/PublicServiceCatalog";
import { CatalogOverlay, PublicCatalog } from "../../catalog/PublicCatalog";

type CatalogKind = "services" | "packages" | "venues";

export function PublicSite({
  onEnterCustomer,
}: {
  onEnterCustomer: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [catalogOverlay, setCatalogOverlay] = useState<CatalogKind | null>(
    null,
  );

  return (
    <div className="public-site">
      <header className="public-header">
        <Brand />
        <nav className={`public-nav ${mobileOpen ? "open" : ""}`}>
          <a href="#packages">Packages</a>
          <a href="#services">Services</a>
          <a href="#venues">Venues</a>
          <a href="#about">About us</a>
        </nav>
        <div className="header-actions">
          <Button variant="link" onClick={onEnterCustomer}>
            Sign in
          </Button>
          <Button onClick={onEnterCustomer}>Get started</Button>
          <Button
            variant="plain"
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Open navigation"
          >
            <Icon name={mobileOpen ? "close" : "menu"} />
          </Button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div
            className="hero-image"
            aria-label="Elegant outdoor catered dinner table"
          ></div>
          <div className="hero-overlay"></div>
          <div className="hero-content">
            <Badge tone="cream">Events, beautifully managed</Badge>
            <div className="display-title">
              Gather well.
              <br />
              We’ll handle the rest.
            </div>
            <p>
              Plan celebrations, team gatherings, and milestone occasions with
              clear packages, shared updates, and seamless coordination.
            </p>
            <div className="hero-actions">
              <Button
                variant="light"
                onClick={() => setQuoteOpen(true)}
                icon="arrow"
              >
                Explore planning
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  document
                    .querySelector("#packages")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Explore packages
              </Button>
            </div>
          </div>
          <div className="hero-trust">
            <div>
              <strong>4.9</strong>
              <span>average guest rating</span>
            </div>
            <div>
              <strong>420+</strong>
              <span>events served with care</span>
            </div>
            <div>
              <strong>12 yrs</strong>
              <span>of trusted experience</span>
            </div>
          </div>
        </section>

        <section className="packages section" id="packages">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Curated experiences</span>
              <h2 className="section-title small">
                A thoughtful place to begin
              </h2>
            </div>
            <p>
              Every package can be tailored to your menu, setting, guest count,
              and service needs.
            </p>
          </div>
          <PackageCatalog onViewMore={() => setCatalogOverlay("packages")} />
        </section>

        <section
          className="public-services section"
          id="services"
          aria-labelledby="services-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">Make it yours</span>
              <h2 className="section-title small" id="services-title">
                Explore our services
              </h2>
            </div>
            <p>
              Discover services for your celebration and discuss the details
              with our team.
            </p>
          </div>
          <PublicServiceCatalog
            onViewMore={() => setCatalogOverlay("services")}
          />
        </section>

        <section
          className="public-venues section"
          id="venues"
          aria-labelledby="venues-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">Find your setting</span>
              <h2 className="section-title small" id="venues-title">
                Explore our venues
              </h2>
            </div>
            <p>
              Discover published venues and their details. Availability is
              confirmed by our team when reviewing your request.
            </p>
          </div>
          <PublicCatalog
            kind="venues"
            onViewMore={() => setCatalogOverlay("venues")}
          />
        </section>

        <section className="intro section" id="intro">
          <div>
            <span className="eyebrow">Your occasion, considered</span>
            <div className="section-title">
              More than a checklist.
              <br />
              One place for every event detail.
            </div>
          </div>
          <div className="intro-copy">
            <p>
              Styled by AMAC connects package discovery, booking requests, schedules,
              team updates, and event progress in one simple experience.
            </p>
            <ActionLink href="#packages">How Styled by AMAC works</ActionLink>
          </div>
        </section>

        <section className="cta section" id="about">
          <div>
            <span className="eyebrow light">
              Let’s create something memorable
            </span>
            <div className="section-title">Your table is waiting.</div>
          </div>
          <Button
            variant="light"
            onClick={() => setQuoteOpen(true)}
            icon="arrow"
          >
            Tell us about your event
          </Button>
        </section>
      </main>

      <footer className="public-footer">
        <Brand light />
        <p>
          Thoughtful event planning and calm coordination, from first idea to
          final update.
        </p>
        <div>
          <a href="#packages">Packages</a>
          <a href="#services">Services</a>
          <a href="#venues">Venues</a>
          <a href="#about">Contact</a>
        </div>
        <span>© 2025 Styled by AMAC</span>
      </footer>

      {quoteOpen && (
        <Dialog onClose={() => setQuoteOpen(false)} title="Event inquiries">
          <p>
            Online inquiries are not available yet. Viewing a package does not
            reserve a date.
          </p>
          <Button onClick={() => setQuoteOpen(false)}>Close</Button>
        </Dialog>
      )}
      {catalogOverlay && (
        <CatalogOverlay
          kind={catalogOverlay}
          onClose={() => setCatalogOverlay(null)}
        />
      )}
    </div>
  );
}
