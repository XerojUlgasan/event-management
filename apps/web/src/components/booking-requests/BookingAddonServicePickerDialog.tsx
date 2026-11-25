import { useRef } from "react";
import { createPortal } from "react-dom";
import { Button, Dialog } from "@event-management/ui";
import type { CatalogServicePreview } from "@event-management/contracts/catalog";
import { CatalogPicker } from "../catalog/CatalogPicker";
import type { CatalogPageQuery } from "../../lib/data/catalog/page-query";
import {
  getServices,
  type PublicService,
} from "../../lib/data/catalog/services";

async function loadServices(search: string, cursor?: string) {
  const page = await getServices({
    limit: 20,
    search,
    ...(cursor ? { cursor } : {}),
  } as CatalogPageQuery);

  return {
    items: page.services as PublicService[],
    nextCursor: page.nextCursor,
  };
}

export function BookingAddonServicePickerDialog({
  onClose,
  onSelect,
  isItemSelected,
}: {
  onClose: () => void;
  onSelect: (service: PublicService) => void;
  isItemSelected?: (service: PublicService) => boolean;
}) {
  const searchRef = useRef<HTMLInputElement>(null);

  return createPortal(
    <Dialog
      title="Choose a service"
      intro="Browse services below to add optional extras to your booking request. Catalog prices are indicative."
      onClose={onClose}
      initialFocus={searchRef}
      className="pe-reference-picker"
      actions={
        <Button onClick={onClose} variant="secondary">
          Done
        </Button>
      }
    >
      <CatalogPicker<PublicService & CatalogServicePreview>
        plural="services"
        loadPage={loadServices}
        searchRef={searchRef}
        isItemSelected={isItemSelected}
        onSelect={onSelect}
      />
    </Dialog>,
    document.body,
  );
}