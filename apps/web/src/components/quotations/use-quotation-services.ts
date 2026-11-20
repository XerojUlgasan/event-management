import { useEffect, useState } from "react";
import { useNotifications } from "@event-management/ui";
import {
  getAdminServices,
  type AdminService,
} from "../../lib/data/catalog/services";
import { useRequestGeneration } from "../../lib/pagination/use-request-generation";

export function useQuotationServices({
  admin,
  bookingId,
  quotationId,
}: {
  admin: boolean;
  bookingId?: string;
  quotationId?: string;
}) {
  const { notifyError } = useNotifications();
  const generation = useRequestGeneration();
  const [services, setServices] = useState<AdminService[]>([]);
  const [serviceError, setServiceError] = useState("");
  const [serviceCursor, setServiceCursor] = useState<string | null>(null);
  const [serviceLoading, setServiceLoading] = useState(false);

  async function loadServices(cursor?: string) {
    const current = generation.current();

    setServiceLoading(true);

    try {
      const result = await getAdminServices({ cursor });

      if (!generation.isCurrent(current)) return;

      setServices((previous) =>
        cursor ? [...previous, ...result.services] : result.services,
      );
      setServiceCursor(result.nextCursor);
      setServiceError("");
    } catch (cause) {
      if (!generation.isCurrent(current)) return;

      setServiceError(notifyError(cause, "Unable to load services."));
    } finally {
      if (generation.isCurrent(current)) setServiceLoading(false);
    }
  }

  useEffect(() => {
    if (admin) void loadServices();

    return () => {
      generation.bump();
    };
  }, [bookingId, admin, quotationId]);

  return {
    services,
    serviceError,
    serviceCursor,
    serviceLoading,
    loadServices,
  };
}
