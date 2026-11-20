import { Button } from "@event-management/ui";

export function QuotationEmptyState({
  canWrite,
  proposalAvailable,
  busy,
  onCreateDraft,
}: {
  canWrite: boolean;
  proposalAvailable: boolean;
  busy: boolean;
  onCreateDraft: () => void;
}) {
  return (
    <section className="quotation-empty">
      <h2>No quotation yet</h2>
      {canWrite && !proposalAvailable && (
        <p>Prepare or choose a package before creating a quotation.</p>
      )}
      {canWrite && proposalAvailable && (
        <>
          <p className="quotation-lede">
            Create a draft from the current package price. You can add
            adjustments before sending it.
          </p>
          <Button disabled={busy} onClick={onCreateDraft}>
            Create draft
          </Button>
        </>
      )}
    </section>
  );
}
