import {
  CatalogCanvas,
  Markdown,
  CatalogSections,
  CatalogWidgetContent,
} from "@event-management/ui";
import type {
  CatalogSection,
  CatalogWidget,
  PackageContent,
} from "@event-management/contracts/catalog";
import type { ReactNode } from "react";
import type { ServiceContent } from "../../lib/data/catalog/services";
import { catalogMediaSrc } from "../../lib/data/catalog/media";
import {
  priceLabel,
  servicePricingLabels,
} from "../../lib/utils/formatting/money";
import "../../styles/catalog/catalog-content.css";
import { useCatalogNavigation } from "./catalog-navigation-context";

const resolveWidget = (widget: CatalogWidget): CatalogWidget => ({
  ...widget,
  media: widget.media
    ? { ...widget.media, url: catalogMediaSrc(widget.media.url) }
    : null,
  package: widget.package
    ? {
        ...widget.package,
        imageUrl: widget.package.imageUrl
          ? catalogMediaSrc(widget.package.imageUrl)
          : null,
      }
    : widget.package,
  service: widget.service
    ? {
        ...widget.service,
        imageUrl: widget.service.imageUrl
          ? catalogMediaSrc(widget.service.imageUrl)
          : null,
      }
    : widget.service,
});

const resolveSections = (sections: CatalogSection[]): CatalogSection[] =>
  sections.map((section) => ({
    ...section,
    widgets: section.widgets.map(resolveWidget),
  }));

// URL resolution belongs to the app; presentation is shared with public SSR.
export function WidgetContent({
  widget,
  editor = false,
  mediaPlaceholder,
  includedService = false,
}: {
  widget: CatalogWidget;
  editor?: boolean;
  includedService?: boolean;
  mediaPlaceholder?: ReactNode;
}) {
  return (
    <CatalogWidgetContent
      widget={resolveWidget(widget)}
      editor={editor}
      includedService={includedService}
      mediaPlaceholder={mediaPlaceholder}
    />
  );
}

export function PackageCanvas({
  item,
  bookingAction,
  showAddons = false,
}: {
  item: PackageContent;
  showAddons?: boolean;
  bookingAction?: ReactNode;
}) {
  const openCatalog = useCatalogNavigation();

  return (
    <CatalogCanvas>
      <div className="catalog-detail-intro">
        <span>THE STYLED BY AMAC COLLECTION</span>
        <h1>{item.name || "Untitled package"}</h1>
        {item.description && <p>{item.description}</p>}
        <div className="catalog-detail-meta">
          <strong>{priceLabel(item.price)}</strong>
          <strong>Up to {item.maxGuests} guests</strong>
        </div>
        {bookingAction && (
          <div className="catalog-detail-action">{bookingAction}</div>
        )}
      </div>
      <CatalogSections
        sections={resolveSections(item.sections)}
        includedServices
        onOpenService={
          openCatalog
            ? (id) => openCatalog({ entity: "service", id })
            : undefined
        }
        onOpenPackage={
          openCatalog
            ? (id) => openCatalog({ entity: "package", id })
            : undefined
        }
      />
      {showAddons && !!item.addonServices?.length && (
        <section className="catalog-addons">
          <h2>Addon Services</h2>
          <div className="catalog-addons-grid">
            {item.addonServices.map((addon) => {
              const pricing = servicePricingLabels(addon);
              const widget: CatalogWidget = {
                id: addon.id,
                type: "service",
                x: 0,
                y: 0,
                w: 6,
                h: 5,
                markdown: "",
                media: null,
                alt: "",
                caption: "",
                autoplay: false,
                serviceId: addon.serviceId,
                service: addon.service,
              };

              return (
                <article className="catalog-addon" key={addon.id}>
                  {addon.service ? (
                    <CatalogWidgetContent
                      widget={resolveWidget(widget)}
                      onOpenService={
                        openCatalog
                          ? (id) => openCatalog({ entity: "service", id })
                          : undefined
                      }
                    />
                  ) : (
                    <p>Unavailable service</p>
                  )}
                  <p className="catalog-addon-pricing">
                    <strong>{pricing.price}</strong>
                    {pricing.excess && <span>{pricing.excess}</span>}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </CatalogCanvas>
  );
}

export function ServiceCanvas({ item }: { item: ServiceContent }) {
  const pricing = servicePricingLabels(item);
  const openCatalog = useCatalogNavigation();

  return (
    <CatalogCanvas>
      <div className="catalog-detail-intro">
        <h1>{item.name || "Untitled service"}</h1>
        <div className="catalog-detail-summary">
          <Markdown source={item.description} />
        </div>
        <div className="catalog-detail-meta">
          <strong>{pricing.price}</strong>
          {pricing.excess && <span>{pricing.excess}</span>}
        </div>
      </div>
      <CatalogSections
        sections={resolveSections(item.sections)}
        onOpenService={
          openCatalog
            ? (id) => openCatalog({ entity: "service", id })
            : undefined
        }
        onOpenPackage={
          openCatalog
            ? (id) => openCatalog({ entity: "package", id })
            : undefined
        }
      />
    </CatalogCanvas>
  );
}
