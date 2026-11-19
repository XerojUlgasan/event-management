import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Badge,
  Button,
  CatalogThumbnail,
  Dialog,
  FormField,
  Input,
} from "@event-management/ui";
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog";
import { getAdminServices } from "../../lib/data/catalog/services";
import { getAdminPackages } from "../../lib/data/catalog/packages";
import type { CatalogServicePreview } from "@event-management/contracts/catalog";
import { catalogMediaSrc } from "../../lib/data/catalog/media";

// API pages include pricing and nested canvases; widgets only carry this preview.
const preview = ({
  id,
  slug,
  name,
  description,
  imageUrl,
}: CatalogServicePreview): CatalogServicePreview => ({
  id,
  slug,
  name,
  description,
  imageUrl,
});

export function CatalogReferencePickerDialog({
  kind,
  selectedId,
  caption,
  onCaptionChange,
  onSelect,
  onClose,
}: {
  kind: "service" | "package";
  selectedId?: string | null;
  caption: string;
  onCaptionChange: (caption: string) => void;
  onSelect: (item: CatalogServicePreview) => void;
  onClose: () => void;
}) {
  const plural = kind === "package" ? "packages" : "services";

  const loadPage = async (search: string, cursor?: string) => {
    const query = { archived: "active" as const, search, cursor };

    if (kind === "package") {
      const page = await getAdminPackages(query);

      return { items: page.packages.map(preview), nextCursor: page.nextCursor };
    }

    const page = await getAdminServices(query);

    return { items: page.services.map(preview), nextCursor: page.nextCursor };
  };

  const searchRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CatalogServicePreview[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(false);
    setItems([]);
    setCursor(null);

    const timer = window.setTimeout(
      () => {
        void loadPage(search.trim()).then(
          (page) => {
            if (id !== requestId.current) return;

            setItems(page.items);
            setCursor(page.nextCursor);
            setLoading(false);
          },
          () => {
            if (id !== requestId.current) return;

            setError(true);
            setLoading(false);
          },
        );
      },
      search ? 250 : 0,
    );

    return () => {
      window.clearTimeout(timer);
      requestId.current++;
    };
  }, [search, retry, kind]);

  const loadMore = async () => {
    if (!cursor || loading) return;

    const id = ++requestId.current;
    setLoading(true);
    setError(false);

    try {
      const page = await loadPage(search.trim(), cursor);

      if (id !== requestId.current) return;

      setItems((previous) => [...previous, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  return createPortal(
    <Dialog
      title={`Choose a ${kind}`}
      intro={`Choose a ${kind} below to add its photo and details to this widget.`}
      onClose={onClose}
      initialFocus={searchRef}
      className="pe-reference-picker"
      actions={
        <Button onClick={onClose} variant="secondary">
          Done
        </Button>
      }
    >
      <FormField label={`Search ${plural}`}>
        {(props) => (
          <Input
            {...props}
            ref={searchRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or description"
          />
        )}
      </FormField>
      <div className="pe-reference-options" aria-busy={loading}>
        {items.map((item) => (
          <Button
            key={item.id}
            variant="plain"
            type="button"
            className="pe-reference-option"
            aria-pressed={item.id === selectedId}
            onClick={() => onSelect(item)}
          >
            <CatalogThumbnail
              className="pe-reference-option-image"
              src={item.imageUrl ? catalogMediaSrc(item.imageUrl) : null}
            />
            <span className="pe-reference-option-copy">
              <strong>{item.name}</strong>
              <span>{item.description}</span>
            </span>
            {item.id === selectedId && <Badge>Selected</Badge>}
          </Button>
        ))}
        {loading && <p role="status">Loading {plural}…</p>}
        {!loading && !error && items.length === 0 && (
          <p role="status">
            {search.trim()
              ? `No ${plural} match your search.`
              : `No active ${plural} are available.`}
          </p>
        )}
        {error && (
          <p role="alert">
            Unable to load {plural}.{" "}
            <Button
              variant="secondary"
              type="button"
              onClick={() =>
                items.length ? void loadMore() : setRetry((n) => n + 1)
              }
            >
              Retry
            </Button>
          </p>
        )}
        {cursor && !loading && !error && (
          <Button
            variant="secondary"
            type="button"
            onClick={() => void loadMore()}
          >
            Load more {plural}
          </Button>
        )}
      </div>
      <FormField label="Caption (optional)">
        {(props) => (
          <Input
            {...props}
            value={caption}
            maxLength={MAX_CATALOG_TEXT_LENGTH}
            onChange={(event) => onCaptionChange(event.target.value)}
          />
        )}
      </FormField>
      <p className="pe-reference-picker-note">Changes apply when you save.</p>
    </Dialog>,
    document.body,
  );
}
