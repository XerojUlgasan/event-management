import { Button, CatalogThumbnail } from "@event-management/ui";
import {
  packageImageSrc,
  type PublicPackage,
} from "../../lib/data/catalog/packages";
import type { PublicService } from "../../lib/data/catalog/services";
import {
  priceLabel,
  servicePricingLabels,
} from "../../lib/utils/formatting/money";

type CardAction = { href: string } | { onPreview: () => void };

function CatalogListingCard({
  kind,
  item,
  price,
  secondary,
  action,
}: {
  kind: "package" | "service";
  item: Pick<PublicPackage, "name" | "description" | "imageUrl">;
  price: string;
  secondary?: string;
  action: CardAction;
}) {
  const link = "href" in action;
  const actionLabel = (
    <>
      View {kind} <span aria-hidden="true">↗</span>
    </>
  );
  const content = (
    <>
      <div className="catalog-card-image">
        <CatalogThumbnail src={packageImageSrc(item.imageUrl)} />
      </div>
      <div className="catalog-card-body">
        <span className="catalog-card-kicker">Event {kind}</span>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <div className="catalog-card-meta">
          <span>{price}</span>
          {secondary && <span>{secondary}</span>}
        </div>
        {link ? (
          <span className="button button-secondary catalog-card-action">
            {actionLabel}
          </span>
        ) : (
          <Button
            variant="secondary"
            className="catalog-card-action"
            onClick={action.onPreview}
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </>
  );

  return (
    <article className="catalog-card">
      {link ? <a href={action.href}>{content}</a> : content}
    </article>
  );
}

export function PackageCard({
  item,
  ...action
}: { item: PublicPackage } & CardAction) {
  return (
    <CatalogListingCard
      kind="package"
      item={item}
      price={priceLabel(item.price)}
      secondary={`Up to ${item.maxGuests} guests`}
      action={action}
    />
  );
}

export function ServiceCard({
  item,
  ...action
}: { item: PublicService } & CardAction) {
  const pricing = servicePricingLabels(item);

  return (
    <CatalogListingCard
      kind="service"
      item={item}
      price={pricing.price}
      secondary={pricing.excess ?? undefined}
      action={action}
    />
  );
}
