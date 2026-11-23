import { useEffect, useState } from "react";
import { Button, Dialog, Select, useNotifications } from "@event-management/ui";
import {
  getPackages,
  type PublicPackage,
} from "../../lib/data/catalog/packages";
import { BookingRequestDialog } from "./BookingRequestDialog";

export function ConversationBooking({
  conversationId,
  onClose,
  onSubmitted,
}: {
  conversationId: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { notifyError } = useNotifications();
  const [packages, setPackages] = useState<PublicPackage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function load(next?: string) {
    setLoading(true);

    try {
      const page = await getPackages(next ? { cursor: next } : undefined);
      setPackages((previous) =>
        next ? [...previous, ...page.packages] : page.packages,
      );
      setCursor(page.nextCursor);
      setError("");
    } catch (cause) {
      setError(notifyError(cause, "Unable to load packages."));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  if (ready)
    return (
      <BookingRequestDialog
        item={packages.find((item) => item.id === selected) ?? null}
        conversationId={conversationId}
        onClose={onClose}
        onSubmitted={onSubmitted}
      />
    );

  return (
    <Dialog title="Create booking request" onClose={onClose}>
      <p>Choose a package or discuss a custom package with us.</p>
      <label>
        Package{" "}
        <Select
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">Discuss a custom package</option>
          {packages.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </label>
      {loading && <p role="status">Loading packages…</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </p>
      )}
      {cursor && (
        <Button
          variant="secondary"
          disabled={loading}
          onClick={() => void load(cursor)}
        >
          Load more packages
        </Button>
      )}
      <p>Your request does not reserve a date or confirm a booking.</p>
      <Button onClick={() => setReady(true)}>Continue</Button>
    </Dialog>
  );
}
