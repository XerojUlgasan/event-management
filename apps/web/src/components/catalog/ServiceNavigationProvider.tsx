import { Button, useNotifications } from "@event-management/ui";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  getService,
  type PublicService,
} from "../../lib/data/catalog/services";
import { ServiceCanvas } from "./CatalogContent";
import { CatalogDetailPreview } from "./CatalogDetailPreview";
import { ServiceNavigationContext } from "./service-navigation-context";

export function ServiceNavigationProvider({
  children,
  route,
}: {
  children: ReactNode;
  route: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    setSelected(null);
  }, [route]);

  return (
    <ServiceNavigationContext.Provider value={setSelected}>
      {children}
      {selected && (
        <CatalogDetailPreview
          entity="service"
          onClose={() => setSelected(null)}
        >
          <ServicePreviewContent key={selected} id={selected} />
        </CatalogDetailPreview>
      )}
    </ServiceNavigationContext.Provider>
  );
}

function ServicePreviewContent({ id }: { id: string }) {
  const [service, setService] = useState<PublicService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const { notifyError } = useNotifications();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getService(id)
      .then((detail) => {
        if (active) setService(detail);
      })
      .catch((reason) => {
        if (active) setError(notifyError(reason, "Unable to load service."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, attempt, notifyError]);

  return (
    <>
      {loading && (
        <p className="package-preview-state" role="status">
          Loading service…
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
      {service && <ServiceCanvas item={service} />}
    </>
  );
}
