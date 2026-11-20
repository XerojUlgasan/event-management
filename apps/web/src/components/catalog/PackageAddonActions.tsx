import { useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Button, Dialog } from "@event-management/ui";
import type { ServicePricing } from "@event-management/contracts/catalog";
import { servicePricingLabels } from "../../lib/utils/formatting/money";
import { ServiceTermsDialog } from "./ServiceTermsDialog";

export function PackageAddonActions({
  name,
  serviceId,
  pricing,
  onEdit,
  onRemove,
  removeFocus,
  className,
  immediate = false,
  disabled = false,
  editDisabled = false,
  refresh,
}: {
  name: string;
  serviceId: string;
  pricing: ServicePricing;
  onEdit: (pricing: ServicePricing) => void | Promise<void>;
  onRemove: () => void | Promise<void>;
  removeFocus: RefObject<HTMLElement | null>;
  className: string;
  immediate?: boolean;
  disabled?: boolean;
  editDisabled?: boolean;
  refresh?: () => Promise<void>;
}) {
  const [dialog, setDialog] = useState<"edit" | "remove" | null>(null);
  const [removing, setRemoving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState("");
  const removingRef = useRef(false);
  const cancelRemoveRef = useRef<HTMLButtonElement>(null);

  async function remove() {
    if (removingRef.current || refresh) return;

    removingRef.current = true;
    setRemoving(true);
    setError("");

    try {
      await onRemove();
      setDialog(null);
      window.requestAnimationFrame(() => removeFocus.current?.focus());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to remove the add-on.",
      );
    } finally {
      removingRef.current = false;
      setRemoving(false);
    }
  }

  async function refreshPackage() {
    if (!refresh || removingRef.current) return;

    removingRef.current = true;
    setRefreshing(true);
    setError("");

    try {
      await refresh();
      setReviewed(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to refresh the package.",
      );
    } finally {
      removingRef.current = false;
      setRefreshing(false);
    }
  }

  const labels = servicePricingLabels(pricing);

  return (
    <div className={className}>
      <Button
        variant="secondary"
        size="icon"
        icon="edit"
        aria-label={`Settings for ${name}`}
        title={`Settings for ${name}`}
        aria-haspopup="dialog"
        disabled={disabled || editDisabled}
        onClick={() => setDialog("edit")}
      />
      <Button
        variant="secondary"
        size="icon"
        icon="trash"
        aria-label={`Remove ${name}`}
        title={`Remove ${name}`}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => {
          setError("");
          setReviewed(false);
          setDialog("remove");
        }}
      />
      {dialog === "edit" && (
        <ServiceTermsDialog
          addon
          immediate={immediate}
          refresh={refresh}
          editDisabled={editDisabled}
          serviceId={serviceId}
          terms={pricing}
          onClose={() => setDialog(null)}
          onSave={async (terms) => {
            await onEdit(terms);
            setDialog(null);
          }}
        />
      )}
      {dialog === "remove" &&
        createPortal(
          <Dialog
            title={`Remove ${name}?`}
            intro={
              immediate
                ? "This removes the add-on from the private package immediately, even if you cancel the quotation."
                : "This removes the add-on when you save the private package."
            }
            initialFocus={cancelRemoveRef}
            onClose={() => {
              if (!removingRef.current) setDialog(null);
            }}
            actions={
              <>
                <Button
                  ref={cancelRemoveRef}
                  variant="secondary"
                  disabled={removing || refreshing}
                  onClick={() => setDialog(null)}
                >
                  Cancel
                </Button>
                {refresh && (
                  <Button
                    variant="secondary"
                    pending={refreshing}
                    onClick={() => void refreshPackage()}
                  >
                    Refresh package
                  </Button>
                )}
                <Button
                  variant="danger"
                  pending={removing}
                  disabled={!!refresh}
                  onClick={() => void remove()}
                >
                  Remove package add-on
                </Button>
              </>
            }
          >
            {reviewed && (
              <p role="status">
                Current package pricing is {labels.price}
                {labels.excess && ` and ${labels.excess}`}. Review it before
                removing the add-on.
              </p>
            )}
            {error && <p role="alert">{error}</p>}
          </Dialog>,
          document.body,
        )}
    </div>
  );
}
