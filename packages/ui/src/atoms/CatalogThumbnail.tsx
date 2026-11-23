import { BRAND_LOGO_URL } from "../assets/brand";

/** Decorative catalog artwork; a missing or failed image reveals the brand. */
export function CatalogThumbnail({
  src,
  className = "",
  onImageError,
}: {
  src?: string | null;
  className?: string;
  onImageError?: () => void;
}) {
  return (
    <span
      className={`ui-catalog-thumbnail${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      <span
        className="ui-catalog-thumbnail-brand"
        style={{ backgroundImage: `url("${BRAND_LOGO_URL}")` }}
      />
      {src && (
        <img
          key={src}
          data-catalog-thumbnail-image
          src={src}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.hidden = true;
            onImageError?.();
          }}
        />
      )}
    </span>
  );
}
