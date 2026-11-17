import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge, Button, Dialog, FormField, Input } from "@event-management/ui";
import { MAX_CATALOG_TEXT_LENGTH } from "@event-management/contracts/limits/catalog";
import {
  getAdminServices,
  type AdminService,
} from "../../lib/data/catalog/services";
import { catalogMediaSrc } from "../../lib/data/catalog/media";

export function CatalogServicePickerDialog({
  selectedId,
  caption,
  onCaptionChange,
  onSelect,
  onClose,
}: {
  selectedId?: string | null;
  caption: string;
  onCaptionChange: (caption: string) => void;
  onSelect: (service: AdminService) => void;
  onClose: () => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const [search, setSearch] = useState("");
  const [services, setServices] = useState<AdminService[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(false);
    setServices([]);
    setCursor(null);
    const timer = window.setTimeout(
      () => {
        void getAdminServices({
          archived: "active",
          search: search.trim(),
        }).then(
          (page) => {
            if (id !== requestId.current) return;
            setServices(page.services);
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
  }, [search, retry]);

  const loadMore = async () => {
    if (!cursor || loading) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(false);
    try {
      const page = await getAdminServices({
        archived: "active",
        search: search.trim(),
        cursor,
      });
      if (id !== requestId.current) return;
      setServices((previous) => [...previous, ...page.services]);
      setCursor(page.nextCursor);
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  return createPortal(
    <Dialog
      title="Choose a service"
      intro="Choose a service below to add its photo and details to this widget."
      onClose={onClose}
      initialFocus={searchRef}
      className="pe-service-picker"
      actions={
        <Button onClick={onClose} variant="secondary">
          Done
        </Button>
      }
    >
      <FormField label="Search services">
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
      <div className="pe-service-options" aria-busy={loading}>
        {services.map((service) => (
          <Button
            key={service.id}
            variant="plain"
            type="button"
            className="pe-service-option"
            aria-pressed={service.id === selectedId}
            onClick={() => onSelect(service)}
          >
            {service.imageUrl ? (
              <img src={catalogMediaSrc(service.imageUrl)} alt="" />
            ) : (
              <span className="pe-service-option-image" aria-hidden="true">
                No photo
              </span>
            )}
            <span className="pe-service-option-copy">
              <strong>{service.name}</strong>
              <span>{service.description}</span>
            </span>
            {service.id === selectedId && <Badge>Selected</Badge>}
          </Button>
        ))}
        {loading && <p role="status">Loading services…</p>}
        {!loading && !error && services.length === 0 && (
          <p role="status">
            {search.trim()
              ? "No services match your search."
              : "No active services are available."}
          </p>
        )}
        {error && (
          <p role="alert">
            Unable to load services.{" "}
            <Button
              variant="secondary"
              type="button"
              onClick={() =>
                services.length ? void loadMore() : setRetry((n) => n + 1)
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
            Load more services
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
      <p className="pe-service-picker-note">Changes apply when you save.</p>
    </Dialog>,
    document.body,
  );
}
