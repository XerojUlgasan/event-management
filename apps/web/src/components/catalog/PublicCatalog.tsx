import { lockCatalogScroll } from "./catalog-scroll-lock";
import { DEFAULT_PAGE_SIZE } from "@event-management/contracts/pagination";
import {
  catalogFilterScope,
  type CatalogFilters,
  type CatalogKind,
} from "@event-management/contracts/catalog-filters";
import { usePagination } from "../../lib/pagination/use-pagination";
import { useRequestGeneration } from "../../lib/pagination/use-request-generation";
import {
  Button,
  CatalogThumbnail,
  Pagination,
  NativeDialog,
  useNotifications,
} from "@event-management/ui";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getPackage,
  getPackages,
  packageImageSrc,
  type PublicPackage,
} from "../../lib/data/catalog/packages";
import {
  getService,
  getServices,
  type PublicService,
} from "../../lib/data/catalog/services";
import { PackagePreview } from "./PackagePreview";
import {
  priceLabel,
  servicePricingLabels,
} from "../../lib/utils/formatting/money";
import { CatalogDetailPreview } from "./CatalogDetailPreview";
import { ServiceCanvas } from "./CatalogContent";
import { CatalogFiltersForm } from "./CatalogFiltersForm";

type Kind = CatalogKind;

type Preview = { kind: Kind; id: string } | null;

function PackageCard({
  item,
  onPreview,
}: {
  item: PublicPackage;
  onPreview: () => void;
}) {
  return (
    <article className="catalog-card">
      <div className="catalog-card-image">
        <CatalogThumbnail src={packageImageSrc(item.imageUrl)} />
      </div>
      <div className="catalog-card-body">
        <span className="catalog-card-kicker">Event package</span>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <div className="catalog-card-meta">
          <span>{priceLabel(item.price)}</span>
          <span>Up to {item.maxGuests} guests</span>
        </div>
        <Button
          variant="secondary"
          type="button"
          className="catalog-card-action"
          onClick={onPreview}
        >
          View package <span aria-hidden="true">↗</span>
        </Button>
      </div>
    </article>
  );
}

function ServiceCard({
  item,
  onPreview,
}: {
  item: PublicService;
  onPreview: () => void;
}) {
  const pricing = servicePricingLabels(item);

  return (
    <article className="catalog-card">
      <div className="catalog-card-image">
        <CatalogThumbnail src={packageImageSrc(item.imageUrl)} />
      </div>
      <div className="catalog-card-body">
        <span className="catalog-card-kicker">Event service</span>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <div className="catalog-card-meta">
          <span>{pricing.price}</span>
          {pricing.excess && <span>{pricing.excess}</span>}
        </div>
        <Button
          variant="secondary"
          type="button"
          className="catalog-card-action"
          onClick={onPreview}
        >
          View service <span aria-hidden="true">↗</span>
        </Button>
      </div>
    </article>
  );
}

function ServicePreview({ id, onClose }: { id: string; onClose: () => void }) {
  const { notifyError } = useNotifications();
  const [service, setService] = useState<PublicService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    getService(id)
      .then((detail) => {
        if (active) setService(detail);
      })
      .catch((reason) => {
        if (active) {
          setError(notifyError(reason, "Unable to load service."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, notifyError]);

  return (
    <CatalogDetailPreview entity="service" onClose={onClose}>
      {loading && (
        <p className="package-preview-state" role="status">
          Loading service…
        </p>
      )}
      {error && (
        <p className="package-preview-state" role="alert">
          {error}
        </p>
      )}
      {service && <ServiceCanvas item={service} />}
    </CatalogDetailPreview>
  );
}

function CatalogPreview({
  selected,
  onClose,
  allowBooking,
}: {
  selected: Preview;
  onClose: () => void;
  allowBooking: boolean;
}) {
  const { notifyError } = useNotifications();
  const [packageDetail, setPackageDetail] = useState<PublicPackage | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (selected?.kind !== "packages") return;

    let active = true;
    setPackageDetail(null);
    setLoading(true);
    setError("");
    getPackage(selected.id)
      .then((detail) => {
        if (active) setPackageDetail(detail);
      })
      .catch((reason) => {
        if (active) {
          setError(notifyError(reason, "Unable to load package."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selected, notifyError]);

  if (selected?.kind === "services")
    return <ServicePreview id={selected.id} onClose={onClose} />;

  if (selected?.kind === "packages")
    return (
      <PackagePreview
        allowBooking={allowBooking}
        item={packageDetail}
        loading={loading}
        error={error}
        onClose={onClose}
      />
    );

  return null;
}

export function PublicCatalog({
  kind,
  mode = "featured",
  allowBooking = true,
  onViewMore,
  showFilters = false,
}: {
  kind: Kind;
  mode?: "featured" | "overview";
  allowBooking?: boolean;
  onViewMore?: () => void;
  showFilters?: boolean;
}) {
  const { notifyError } = useNotifications();
  const [filters, setFilters] = useState<CatalogFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  const topRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<(PublicPackage | PublicService)[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const filterScope = catalogFilterScope(kind, filters);
  const pagination = usePagination(`${filterScope}:${mode}`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [selected, setSelected] = useState<Preview>(null);
  const [parentService, setParentService] = useState<string | null>(null);
  const busy = useRef(false);
  const generation = useRequestGeneration();
  const limit = mode === "featured" ? 3 : DEFAULT_PAGE_SIZE;

  const load = useCallback(
    async (cursor: string | undefined) => {
      if (busy.current) return;

      const current = generation.current();
      busy.current = true;
      setLoading(true);
      setError("");
      setItems([]);
      setNextCursor(null);

      try {
        if (kind === "packages") {
          const result = await getPackages({ limit, cursor, ...filters });

          if (!generation.isCurrent(current)) return;

          setItems(result.packages);
          setNextCursor(result.nextCursor);
        } else {
          const result = await getServices({ limit, cursor, ...filters });

          if (!generation.isCurrent(current)) return;

          setItems(result.services);
          setNextCursor(result.nextCursor);
        }
      } catch (reason) {
        if (generation.isCurrent(current))
          setError(notifyError(reason, `Unable to load ${kind}.`));
      } finally {
        if (generation.isCurrent(current)) {
          busy.current = false;
          setLoading(false);
          setInitialized(true);
        }
      }
    },
    [kind, limit, filters, notifyError],
  );

  useEffect(() => {
    void load(pagination.cursor);

    return () => {
      generation.bump();
      busy.current = false;
    };
  }, [load, pagination.cursor]);

  const showPackage = (id: string) => {
    if (selected?.kind === "services") setParentService(selected.id);

    setSelected({ kind: "packages", id });
  };

  const closePreview = () => {
    if (selected?.kind === "packages" && parentService) {
      setSelected({ kind: "services", id: parentService });
      setParentService(null);
    } else setSelected(null);
  };

  const scrollToTop = () => {
    topRef.current?.focus({ preventScroll: true });
    topRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  };

  const hasFilters = Object.keys(filters).length > 0;

  return (
    <div className="catalog-browser" ref={topRef} tabIndex={-1}>
      {showFilters && (
        <>
          <div className="catalog-toolbar">
            <p
              className="catalog-results-summary"
              role="status"
              aria-live="polite"
            >
              {loading || !initialized
                ? `Loading ${kind}…`
                : error
                  ? `Unable to show ${kind}. Try again below.`
                  : `Showing ${items.length} ${kind}${hasFilters ? " matching your filters" : ""} · Page ${pagination.page}`}
            </p>
            <Button
              variant="secondary"
              size="icon"
              icon="filter"
              className="catalog-filter-toggle"
              aria-label={filtersOpen ? "Hide filters" : "Show filters"}
              title={filtersOpen ? "Hide filters" : "Show filters"}
              aria-expanded={filtersOpen}
              aria-controls={filtersId}
              data-active={hasFilters || undefined}
              onClick={() => setFiltersOpen((open) => !open)}
            />
          </div>
          <div id={filtersId} hidden={!filtersOpen}>
            <CatalogFiltersForm
              key={kind}
              kind={kind}
              filters={filters}
              onApply={(next) => {
                setFilters(next);
                pagination.reset();
              }}
            />
          </div>
        </>
      )}
      {(!initialized || loading) && (
        <p className="catalog-status" role="status">
          Loading {kind}…
        </p>
      )}
      {initialized && !loading && items.length === 0 && !error && (
        <p className="catalog-status">
          {hasFilters
            ? `No ${kind} match your filters. Adjust your filters or use Clear to see all ${kind}.`
            : kind === "packages"
              ? "No packages are published yet."
              : "Our service catalog is being prepared. Please check back soon."}
        </p>
      )}
      {items.length > 0 && (
        <div className="catalog-grid">
          {kind === "packages"
            ? (items as PublicPackage[]).map((item) => (
                <PackageCard
                  key={item.id}
                  item={item}
                  onPreview={() => showPackage(item.id)}
                />
              ))
            : (items as PublicService[]).map((item) => (
                <ServiceCard
                  key={item.id}
                  item={item}
                  onPreview={() =>
                    setSelected({ kind: "services", id: item.id })
                  }
                />
              ))}
        </div>
      )}
      {error && (
        <p className="catalog-status" role="alert">
          {error}{" "}
          <Button
            variant="secondary"
            type="button"
            onClick={() => void load(pagination.cursor)}
          >
            Try again
          </Button>
        </p>
      )}
      {mode === "featured" && onViewMore && (
        <Button
          variant="secondary"
          type="button"
          className="catalog-view-more"
          onClick={onViewMore}
        >
          View more {kind}
          <span aria-hidden="true">↗</span>
        </Button>
      )}
      {mode === "overview" && initialized && (
        <Pagination
          page={pagination.page}
          hasNextPage={nextCursor !== null}
          pending={loading}
          onPrevious={() => {
            pagination.previous();
            scrollToTop();
          }}
          onNext={() => {
            pagination.next(nextCursor);
            scrollToTop();
          }}
          label="Catalog pages"
        />
      )}
      <CatalogPreview
        allowBooking={allowBooking}
        selected={selected}
        onClose={closePreview}
      />
    </div>
  );
}

export function CatalogOverlay({
  kind,
  onClose,
}: {
  kind: Kind;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const unlockScroll = lockCatalogScroll();
    dialog?.showModal();
    dialog?.querySelector<HTMLButtonElement>(".package-preview-close")?.focus();

    return () => {
      dialog?.close();
      unlockScroll();
      trigger?.focus();
    };
  }, []);

  return createPortal(
    <NativeDialog
      ref={dialogRef}
      className="package-preview catalog-overlay"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="package-preview-bar">
        <Button
          variant="plain"
          type="button"
          className="package-preview-close"
          aria-label="Close catalog"
          onClick={onClose}
        >
          ×
        </Button>
        <span className="package-preview-brand">Styled by AMAC</span>
        <span className="package-preview-divider" aria-hidden="true" />
        <span className="package-preview-label">The collection</span>
      </header>
      <div className="package-preview-scroll">
        <main className="catalog-overlay-main">
          <span className="package-preview-overline">
            The Styled by AMAC collection
          </span>
          <h1 id={titleId}>All {kind}</h1>
          <p>Explore {kind} for your gathering.</p>
          <PublicCatalog kind={kind} mode="overview" />
        </main>
      </div>
    </NativeDialog>,
    document.body,
  );
}
