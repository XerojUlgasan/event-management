import { Button, useNotifications } from "@event-management/ui";
import { useEffect, useState } from "react";
import {
  getService,
  type PublicService,
} from "../../lib/data/catalog/services";
import {
  getPackage,
  type PublicPackage,
} from "../../lib/data/catalog/packages";
import { PackageCanvas, ServiceCanvas } from "./CatalogContent";
import type { CatalogSelection } from "./catalog-navigation-context";

export function CatalogPreviewContent({
  selection,
}: {
  selection: CatalogSelection;
}) {
  const { id, entity } = selection;
  const [detail, setDetail] = useState<
    | { entity: "service"; item: PublicService }
    | { entity: "package"; item: PublicPackage }
    | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const { notifyError } = useNotifications();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const request =
      entity === "package"
        ? getPackage(id).then((item) => ({ entity: "package" as const, item }))
        : getService(id).then((item) => ({ entity: "service" as const, item }));

    request
      .then((result) => {
        if (active) setDetail(result);
      })
      .catch((reason) => {
        if (active) setError(notifyError(reason, `Unable to load ${entity}.`));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, entity, attempt, notifyError]);

  return (
    <>
      {loading && (
        <p className="package-preview-state" role="status">
          Loading {entity}…
        </p>
      )}
      {error && (
        <div className="package-preview-state" role="alert">
          <p>{error}</p>
          <Button
            variant="secondary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </Button>
        </div>
      )}
      {detail?.entity === "service" && <ServiceCanvas item={detail.item} />}
      {detail?.entity === "package" && <PackageCanvas item={detail.item} />}
    </>
  );
}
