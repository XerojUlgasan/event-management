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
  Icon,
  Pagination,
  NativeDialog,
  useNotifications,
} from "@event-management/ui";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getPackage,
  getPackages,
  type PublicPackage,
} from "../../lib/data/catalog/packages";
import {
  getService,
  getServices,
  type PublicService,
} from "../../lib/data/catalog/services";
import { PackagePreview } from "./PackagePreview";
import { CatalogDetailPreview } from "./CatalogDetailPreview";
import { ServiceCanvas } from "./CatalogContent";
import { CatalogFiltersForm } from "./CatalogFiltersForm";
import { PackageCard, ServiceCard } from "./CatalogListingCards";
import type { CatalogSelection } from "./catalog-navigation-context";

type Kind = CatalogKind;

type Preview = { kind: Kind; id: string } | null;

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
  onOpenDetail,
}: {
  kind: Kind;
  mode?: "featured" | "overview";
  allowBooking?: boolean;
  onViewMore?: () => void;
  showFilters?: boolean;
  onOpenDetail?: (
    selection: CatalogSelection,
    trigger: HTMLButtonElement,
  ) => void;
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

  const openListing = (id: string, trigger: HTMLButtonElement) => {
    if (onOpenDetail) {
      onOpenDetail(
        { entity: kind === "packages" ? "package" : "service", id },
        trigger,
      );
    } else if (kind === "packages") {
      showPackage(id);
    } else {
      setSelected({ kind, id });
    }
  };

  const scrollToTop = () => {
    topRef.current?.focus({ preventScroll: true });
    topRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  };

  const hasFilters = Object.keys(filters).length > 0;

  // ── Floating filter panel ─────────────────────────────────────────────
  const triggerWrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Build active-filter chip list from current filters state
  function formatPeso(value: number) {
    return `₱${value.toLocaleString()}`;
  }

  const filterChips: { label: string; key: keyof CatalogFilters }[] = [];

  if (filters.eventType !== undefined)
    filterChips.push({ label: filters.eventType, key: "eventType" });

  if (filters.pricingType !== undefined)
    filterChips.push({
      label: filters.pricingType === "fixed" ? "Fixed price" : "Hourly",
      key: "pricingType",
    });

  const hasMin = filters.minPricePesos !== undefined;
  const hasMax = filters.maxPricePesos !== undefined;

  if (hasMin && hasMax)
    filterChips.push({
      label: `${formatPeso(filters.minPricePesos!)}–${formatPeso(filters.maxPricePesos!)}`,
      key: "minPricePesos",
    });
  else if (hasMin)
    filterChips.push({
      label: `From ${formatPeso(filters.minPricePesos!)}`,
      key: "minPricePesos",
    });
  else if (hasMax)
    filterChips.push({
      label: `Up to ${formatPeso(filters.maxPricePesos!)}`,
      key: "maxPricePesos",
    });

  if (kind !== "services" && filters.guests !== undefined)
    filterChips.push({ label: `${filters.guests} guests`, key: "guests" });

  const activeCount = filterChips.length;

  const removeChip = (key: keyof CatalogFilters) => {
    const next = { ...filters };

    if (key === "minPricePesos") {
      delete next.minPricePesos;
      delete next.maxPricePesos;
    } else {
      delete next[key];
    }

    setFilters(next);
    pagination.reset();
  };

  // Escape key + click-outside close
  useEffect(() => {
    if (!filtersOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFiltersOpen(false);
        triggerRef.current?.focus();
      }
    };

    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;

      if (
        !triggerWrapRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setFiltersOpen(false);
      }
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [filtersOpen]);

  return (
    <div className="catalog-browser" ref={topRef} tabIndex={-1}>
      {showFilters && (
        <div className="public-catalog-filters catalog-browser">
          <div className="catalog-toolbar">
            {/* Trigger wrap is the CSS anchor for the floating panel */}
            <div className="catalog-filter-trigger-wrap" ref={triggerWrapRef}>
              <Button
                ref={triggerRef}
                variant="secondary"
                className={`catalog-filter-toggle${activeCount > 0 ? " catalog-filter-toggle--active" : ""}`}
                aria-label={
                  activeCount > 0
                    ? `Filter ${kind} (${activeCount} active)`
                    : `Filter ${kind}`
                }
                aria-expanded={filtersOpen}
                aria-controls={filtersId}
                onClick={() => setFiltersOpen((prev) => !prev)}
              >
                <Icon name="filter" size={17} />
                {activeCount > 0 && (
                  <span className="catalog-filter-badge" aria-hidden="true">
                    {activeCount}
                  </span>
                )}
              </Button>

              {/* Floating panel anchored to trigger-wrap */}
              <div
                id={filtersId}
                ref={panelRef}
                className={`catalog-filter-panel${filtersOpen ? " catalog-filter-panel--open" : ""}`}
                aria-hidden={!filtersOpen}
              >
                <CatalogFiltersForm
                  key={kind}
                  kind={kind}
                  filters={filters}
                  compact
                  onApply={(next) => {
                    setFilters(next);
                    setFiltersOpen(false);
                    pagination.reset();
                  }}
                />
                <Button
                  variant="plain"
                  className="catalog-filter-panel-close"
                  aria-label="Close filters"
                  onClick={() => {
                    setFiltersOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  <Icon name="close" size={15} />
                </Button>
              </div>
            </div>
          </div>

          {/* Active filter chips — shown when panel is closed and filters are active */}
          {!filtersOpen && filterChips.length > 0 && (
            <div
              className="catalog-filter-chips"
              role="group"
              aria-label="Active filters"
            >
              {filterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="catalog-filter-chip"
                  onClick={() => removeChip(chip.key)}
                  aria-label={`Remove filter: ${chip.label}`}
                >
                  {chip.label}
                  <Icon name="close" size={12} />
                </button>
              ))}
              <button
                type="button"
                className="catalog-filter-chip-clear"
                onClick={() => {
                  setFilters({});
                  pagination.reset();
                }}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
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
                  onPreview={(event) =>
                    openListing(item.id, event.currentTarget)
                  }
                />
              ))
            : (items as PublicService[]).map((item) => (
                <ServiceCard
                  key={item.id}
                  item={item}
                  onPreview={(event) =>
                    openListing(item.id, event.currentTarget)
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
