import { useRef, useState } from "react";
import { Button, Dialog, Icon } from "@event-management/ui";
import {
  getPackages,
  type PublicPackage,
} from "../../lib/data/catalog/packages";
import { CatalogPicker, CatalogPickerOption } from "../catalog/CatalogPicker";
import { BookingRequestDialog } from "./BookingRequestDialog";

async function loadPackages(search: string, cursor?: string) {
  const page = await getPackages({ search, cursor });

  return { items: page.packages, nextCursor: page.nextCursor };
}

export function ConversationBooking({
  conversationId,
  onClose,
  onSubmitted,
}: {
  conversationId: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<PublicPackage | null>(null);
  const [ready, setReady] = useState(false);

  if (ready)
    return (
      <BookingRequestDialog
        item={selected}
        conversationId={conversationId}
        onClose={onClose}
        onSubmitted={onSubmitted}
      />
    );

  return (
    <Dialog
      title="Create booking request"
      intro="Choose a package or discuss a custom package with us."
      className="pe-reference-picker"
      onClose={onClose}
      initialFocus={searchRef}
      actions={<Button onClick={() => setReady(true)}>Continue</Button>}
    >
      <CatalogPicker
        plural="packages"
        searchRef={searchRef}
        loadPage={loadPackages}
        selectedId={selected?.id}
        onSelect={setSelected}
        firstOption={
          <CatalogPickerOption
            name="Discuss a custom package"
            description="Tell us what you have in mind for your event."
            artwork={<Icon name="message" />}
            selected={selected === null}
            onSelect={() => setSelected(null)}
          />
        }
      />
      {selected && (
        <p className="pe-reference-picker-note">
          Selected package: <strong>{selected.name}</strong>
        </p>
      )}
      <p className="pe-reference-picker-note">
        Your request does not reserve a date or confirm a booking.
      </p>
    </Dialog>
  );
}
