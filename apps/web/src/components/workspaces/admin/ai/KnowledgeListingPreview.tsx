import { useEffect, useState } from "react";
import { Button, useNotifications } from "@event-management/ui";
import type { KnowledgeSearchResult } from "@event-management/contracts/catalog-knowledge";
import {
  getAdminPackage,
  type AdminPackage,
} from "../../../../lib/data/catalog/packages";
import {
  getAdminService,
  type AdminService,
} from "../../../../lib/data/catalog/services";
import { PackagePreview } from "../../../catalog/PackagePreview";
import { CatalogDetailPreview } from "../../../catalog/CatalogDetailPreview";
import { ServiceCanvas } from "../../../catalog/CatalogContent";

type Content =
  | { kind: "package"; item: AdminPackage }
  | { kind: "service"; item: AdminService };

export function KnowledgeListingPreview({
  listing,
  onClose,
}: {
  listing: KnowledgeSearchResult["listing"];
  onClose: () => void;
}) {
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const { notifyError } = useNotifications();

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    const request =
      listing.kind === "package"
        ? getAdminPackage(listing.id).then((item): Content => ({
            kind: "package",
            item,
          }))
        : getAdminService(listing.id).then((item): Content => ({
            kind: "service",
            item,
          }));
    void request
      .then((data) => {
        if (current) setContent(data);
      })
      .catch((cause) => {
        if (current) setError(notifyError(cause, "Could not open listing."));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [listing.kind, listing.id, retry, notifyError]);

  if (listing.kind === "package") {
    return (
      <PackagePreview
        item={content?.kind === "package" ? content.item : null}
        loading={loading}
        error={error}
        showBookingAction={false}
        onRetry={() => setRetry((value) => value + 1)}
        onClose={onClose}
      />
    );
  }
  return (
    <CatalogDetailPreview entity="service" onClose={onClose}>
      {loading && <p role="status">Loading service…</p>}
      {error && (
        <div className="package-preview-state" role="alert">
          <p>{error}</p>
          <Button
            variant="secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </Button>
        </div>
      )}
      {content?.kind === "service" && <ServiceCanvas item={content.item} />}
    </CatalogDetailPreview>
  );
}
