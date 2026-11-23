import { CatalogThumbnail } from "@event-management/ui";
import type { CatalogRecommendation } from "@event-management/contracts/messages";
import { packageImageSrc } from "../../lib/data/catalog/packages";
import {
  priceLabel,
  servicePricingLabels,
} from "../../lib/utils/formatting/money";
import "../../styles/messages/catalog-recommendations.css";

function RecommendationLink({
  recommendation,
  price,
  detail,
}: {
  recommendation: CatalogRecommendation;
  price: string;
  detail: string;
}) {
  const kind = recommendation.type;
  const href = `/${kind === "package" ? "packages" : "services"}/${encodeURIComponent(recommendation.slug)}?catalogId=${encodeURIComponent(recommendation.id)}`;

  return (
    <a
      className="message-catalog-recommendation"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View ${kind}: ${recommendation.name} (opens in a new tab)`}
    >
      <CatalogThumbnail src={packageImageSrc(recommendation.imageUrl)} />
      <span className="message-catalog-recommendation-copy">
        <strong>{recommendation.name}</strong>
        <span className="message-catalog-recommendation-terms">
          <span>{price}</span>
          {detail && <span>{detail}</span>}
        </span>
      </span>
      <span className="message-catalog-recommendation-open" aria-hidden="true">
        ↗
      </span>
    </a>
  );
}

export function CatalogRecommendations({
  recommendations,
}: {
  recommendations?: CatalogRecommendation[];
}) {
  if (!recommendations?.length) return null;

  return (
    <ul
      className="message-catalog-recommendations"
      aria-label="Catalog recommendations"
    >
      {recommendations.map((recommendation) => {
        if (recommendation.type === "package") {
          return (
            <li key={`${recommendation.type}-${recommendation.id}`}>
              <RecommendationLink
                recommendation={recommendation}
                price={priceLabel(recommendation.price)}
                detail={`Up to ${recommendation.maxGuests} guests`}
              />
            </li>
          );
        }

        const pricing = servicePricingLabels(recommendation);

        return (
          <li key={`${recommendation.type}-${recommendation.id}`}>
            <RecommendationLink
              recommendation={recommendation}
              price={pricing.price}
              detail={pricing.excess ?? ""}
            />
          </li>
        );
      })}
    </ul>
  );
}
