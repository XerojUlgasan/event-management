import "../../styles/catalog/catalog-picker.css";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Badge,
  Button,
  CatalogThumbnail,
  FormField,
  Input,
  useNotifications,
} from "@event-management/ui";
import type { CatalogServicePreview } from "@event-management/contracts/catalog";
import { MAX_CATALOG_SEARCH_LENGTH } from "@event-management/contracts/limits/catalog";
import { catalogMediaSrc } from "../../lib/data/catalog/media";

export function CatalogPickerOption({
  name,
  description,
  imageUrl,
  artwork,
  selected,
  onSelect,
}: Pick<CatalogServicePreview, "name" | "description"> & {
  imageUrl?: string | null;
  artwork?: ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      variant="plain"
      type="button"
      className="pe-reference-option"
      aria-pressed={selected}
      onClick={onSelect}
    >
      {artwork ? (
        <span aria-hidden="true" className="pe-reference-option-image">
          {artwork}
        </span>
      ) : (
        <CatalogThumbnail
          className="pe-reference-option-image"
          src={imageUrl ? catalogMediaSrc(imageUrl) : null}
        />
      )}
      <span className="pe-reference-option-copy">
        <strong>{name}</strong>
        <span>{description}</span>
      </span>
      {selected && <Badge>Selected</Badge>}
    </Button>
  );
}

export function CatalogPicker<T extends CatalogServicePreview>({
  plural,
  searchRef,
  selectedId,
  loadPage,
  onSelect,
  firstOption,
}: {
  plural: "packages" | "services";
  searchRef: RefObject<HTMLInputElement | null>;
  selectedId?: string | null;
  loadPage: (
    search: string,
    cursor?: string,
  ) => Promise<{ items: T[]; nextCursor: string | null }>;
  onSelect: (item: T) => void;
  firstOption?: ReactNode;
}) {
  const { notifyError } = useNotifications();
  const requestId = useRef(0);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
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
          (cause: unknown) => {
            if (id !== requestId.current) return;

            setError(notifyError(cause, `Unable to load ${plural}.`));
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
  }, [search, retry, loadPage, plural, notifyError]);

  const loadMore = async () => {
    if (!cursor || loading) return;

    const id = ++requestId.current;
    setLoading(true);
    setError("");

    try {
      const page = await loadPage(search.trim(), cursor);

      if (id !== requestId.current) return;

      setItems((previous) => [...previous, ...page.items]);
      setCursor(page.nextCursor);
    } catch (cause) {
      if (id === requestId.current)
        setError(notifyError(cause, `Unable to load ${plural}.`));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  return (
    <>
      <FormField label={`Search ${plural}`}>
        {(props) => (
          <Input
            {...props}
            ref={searchRef}
            type="search"
            maxLength={MAX_CATALOG_SEARCH_LENGTH}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or description"
          />
        )}
      </FormField>
      <div className="pe-reference-options" aria-busy={loading}>
        {firstOption}
        {items.map((item) => (
          <CatalogPickerOption
            key={item.id}
            name={item.name}
            description={item.description}
            imageUrl={item.imageUrl}
            selected={item.id === selectedId}
            onSelect={() => onSelect(item)}
          />
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
            {error}{" "}
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
    </>
  );
}
