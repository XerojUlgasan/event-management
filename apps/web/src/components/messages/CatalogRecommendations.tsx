import { CatalogThumbnail } from "@event-management/ui";
import type { CatalogRecommendation } from "@event-management/contracts/messages";
import { packageImageSrc } from "../../lib/data/catalog/packages";
import {
  bookingHoursLabel,
  priceLabel,
  servicePricingLabels,
} from "../../lib/utils/formatting/money";
import "../../styles/messages/catalog-recommendations.css";

function inclusionsSummary(
  recommendation: Extract<CatalogRecommendation, { type: "package" }>,
) {
  if (!recommendation.inclusions.length) return recommendation.description;

  const names = recommendation.inclusions
    .slice(0, 2)
    .map((item) =>
      item.includedHours == null
        ? item.name
        : `${item.name} (${bookingHoursLabel(item.includedHours)})`,
    );

  const hasMore = recommendation.inclusions.length > names.length;

  return `Includes ${names.join(", ")}${hasMore ? ", and more" : ""}`;
}

function RecommendationLink({
  recommendation,
  price,
  detail,
  summary,
}: {
  recommendation: CatalogRecommendation;
  price: string;
  detail: string;
  summary: string;
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
        <span className="message-catalog-recommendation-kind">{kind}</span>
        <strong>{recommendation.name}</strong>
        <span className="message-catalog-recommendation-terms">
          <span>{price}</span>
          {detail && <span>{detail}</span>}
        </span>
        {summary && (
          <span className="message-catalog-recommendation-summary">
            {summary}
          </span>
        )}
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
                summary={inclusionsSummary(recommendation)}
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
              summary={recommendation.description}
            />
          </li>
        );
      })}
    </ul>
  );
}
