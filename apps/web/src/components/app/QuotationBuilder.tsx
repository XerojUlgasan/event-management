import { useEffect, useState } from "react";
import {
  getAdminQuotations,
  getAdminServices,
  createQuotation,
  updateQuotation,
  sendQuotation,
  type AdminService,
  type BookingRequest,
  type Quotation,
  type QuotationDirection,
  type QuotationItemInput,
} from "../../lib/api";

const money = (minor: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(minor / 100);

type DraftLine = QuotationItemInput & { localId: string };

const toDraft = (quote: Quotation): DraftLine[] =>
  quote.items.map((item) => ({
    localId: item.id,
    direction: item.direction,
    kind: item.kind,           // preserved from server, not shown in UI
    description: item.description,
    amountMinor: item.amountMinor,
    serviceId: item.serviceId,
    customizationRequestId: item.customizationRequestId,
  }));

// ── Context panel ─────────────────────────────────────────────────────────────

function QuotationContext({
  item,
  services,
  onUseRate,
}: {
  item: BookingRequest;
  services: AdminService[];
  onUseRate: (service: AdminService) => void;
}) {
  const arrangement = item.arrangement;
  const inclusions = item.packageInclusionsSnapshot ?? [];
  const approvedRequests = item.customizationRequests.filter(
    (r) => r.status === "approved",
  );

  return (
    <div className="quotation-context">
      <div className="quotation-context-section">
        <h4 className="quotation-context-heading">Package &amp; event</h4>
        <dl className="quotation-context-dl">
          <div><dt>Package</dt><dd>{item.packageName}</dd></div>
          <div>
            <dt>Base price</dt>
            <dd><strong>{money(item.packagePrice.amountMinor)}</strong></dd>
          </div>
          <div>
            <dt>Event type</dt>
            <dd>{arrangement?.eventType ?? item.eventType}</dd>
          </div>
          <div>
            <dt>Preferred date</dt>
            <dd>{arrangement?.preferredDate ?? item.preferredDate ?? "Not set"}</dd>
          </div>
          <div>
            <dt>Guest count</dt>
            <dd>
              {(arrangement?.guestCount ?? item.guestCount) != null
                ? String(arrangement?.guestCount ?? item.guestCount)
                : "Not sure yet"}
              {(arrangement?.outOfRange ?? item.outOfRange) && (
                <span className="quotation-context-badge quotation-context-badge-warn">
                  {" "}over package max ({item.packageMaxGuests})
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>Venue</dt>
            <dd>
              {arrangement?.preferredVenueLocation ??
                item.preferredVenueLocation ??
                "To be confirmed"}
            </dd>
          </div>
          {arrangement?.notes && (
            <div><dt>Internal notes</dt><dd>{arrangement.notes}</dd></div>
          )}
        </dl>
      </div>

      {inclusions.length > 0 && (
        <div className="quotation-context-section">
          <h4 className="quotation-context-heading">Package inclusions</h4>
          <ul className="quotation-context-list">
            {inclusions.map((inc) => (
              <li key={inc.serviceId} className="quotation-context-inclusion">
                <span>{inc.name}</span>
                <span className={`quotation-context-badge ${inc.role === "included" ? "quotation-context-badge-included" : "quotation-context-badge-optional"}`}>
                  {inc.role}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {approvedRequests.length > 0 && (
        <div className="quotation-context-section">
          <h4 className="quotation-context-heading">
            Approved customizations ({approvedRequests.length})
          </h4>
          <ul className="quotation-context-list">
            {approvedRequests.map((req) => (
              <li key={req.id} className="quotation-context-customization">
                <div className="quotation-context-customization-head">
                  <span className="quotation-context-badge quotation-context-badge-approved">
                    {req.type.replace(/_/g, " ")}
                  </span>
                  <small>by {req.requestedByName}</small>
                </div>
                <p>{req.description}</p>
                {req.decisionReason && <small>Note: {req.decisionReason}</small>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {services.filter((s) => s.hourlyRatePesos != null).length > 0 && (
        <div className="quotation-context-section">
          <h4 className="quotation-context-heading">Service rates</h4>
          <p className="quotation-context-hint">Click a rate to add it as an adjustment.</p>
          <ul className="quotation-context-list">
            {services
              .filter((s) => s.hourlyRatePesos != null)
              .map((s) => (
                <li key={s.id} className="quotation-context-service-rate">
                  <span>{s.name}</span>
                  <button
                    type="button"
                    className="quotation-context-rate-btn"
                    onClick={() => onUseRate(s)}
                  >
                    {money((s.hourlyRatePesos ?? 0) * 100)} / hr
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Quotation preview card ────────────────────────────────────────────────────

function QuotationPreview({
  base,
  lines,
}: {
  base: number;
  lines: DraftLine[];
}) {
  const total =
    base +
    lines.reduce(
      (sum, line) =>
        sum + (line.direction === "add" ? line.amountMinor : -line.amountMinor),
      0,
    );

  return (
    <div className="quotation-preview">
      <div className="quotation-preview-row quotation-preview-base">
        <span>Package base price</span>
        <span>{money(base)}</span>
      </div>
      {lines.length > 0 && (
        <div className="quotation-preview-adjustments">
          <span className="quotation-preview-label">Adjustments</span>
          {lines.map((line) => (
            <div key={line.localId} className="quotation-preview-row">
              <span className="quotation-preview-desc">
                {line.description || <em>Unnamed line</em>}
              </span>
              <span className={`quotation-preview-amount quotation-preview-amount-${line.direction}`}>
                {line.direction === "add" ? "+" : "−"}{money(line.amountMinor)}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className={`quotation-preview-row quotation-preview-total${total < 0 ? " quotation-preview-total-error" : ""}`}>
        <span>Estimated total</span>
        <strong>{money(total)}</strong>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function QuotationBuilder({ item }: { item: BookingRequest }) {
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [draft, setDraft] = useState<Quotation | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // New-line input state
  const [newDesc, setNewDesc] = useState("");
  const [newDir, setNewDir] = useState<QuotationDirection>("add");
  const [newAmount, setNewAmount] = useState("");

  const load = async () => {
    setError("");
    try {
      const [quotationResult, serviceResult] = await Promise.all([
        getAdminQuotations(item.id),
        getAdminServices(),
      ]);
      setQuotes(quotationResult.quotations);
      setServices(serviceResult.services);
      const current = quotationResult.quotations.find(
        (q) => q.status === "draft",
      );
      if (current) {
        setDraft(current);
        setLines(toDraft(current));
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load quotations.",
      );
    }
  };

  useEffect(() => {
    void load();
  }, [item.id]);

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await createQuotation(item.id);
      setDraft(result.quotation);
      setLines([]);
      setQuotes((current) => [result.quotation, ...current]);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to create quotation.",
      );
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const result = await updateQuotation(
        draft.id,
        lines.map(({ localId: _localId, ...line }) => line),
        draft.updatedAt,
      );
      setDraft(result.quotation);
      setLines(toDraft(result.quotation));
      setQuotes((current) =>
        current.map((q) => (q.id === result.quotation.id ? result.quotation : q)),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save quotation.",
      );
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!draft) return;
    if (
      !lines.length ||
      lines.some((line) => !line.description.trim() || line.amountMinor <= 0)
    ) {
      setError("Add a description and positive amount for every line before sending.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await sendQuotation(draft.id);
      setDraft(null);
      setLines([]);
      setQuotes((current) =>
        current.map((q) => (q.id === result.quotation.id ? result.quotation : q)),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to send quotation.",
      );
    } finally {
      setBusy(false);
    }
  };

  const addLine = () => {
    const parsed = Math.round(Number(newAmount) * 100);
    if (!newDesc.trim()) { setError("Enter a description for the line."); return; }
    if (!newAmount || parsed <= 0) { setError("Enter a positive amount."); return; }
    setError("");
    setLines((current) => [
      ...current,
      {
        localId: crypto.randomUUID(),
        direction: newDir,
        kind: "adjustment",   // default kind — not surfaced in UI
        description: newDesc.trim(),
        amountMinor: parsed,
      },
    ]);
    setNewDesc("");
    setNewAmount("");
  };

  const useServiceRate = (service: AdminService) => {
    const amountMinor = Math.round((service.hourlyRatePesos ?? 0) * 100);
    setLines((current) => [
      ...current,
      {
        localId: crypto.randomUUID(),
        direction: "add",
        kind: "adjustment",
        description: `${service.name} (per hour)`,
        amountMinor,
        serviceId: service.id,
      },
    ]);
  };

  const base = draft?.baseAmountMinor ?? item.packagePrice.amountMinor;

  return (
    <section
      className="quotation-builder"
      aria-labelledby={`quotation-${item.id}`}
    >
      <div className="quotation-builder-head">
        <div>
          <h3 id={`quotation-${item.id}`}>Estimated quotation</h3>
          <p>Acceptance is not booking confirmation.</p>
        </div>
        {!draft && (
          <button type="button" disabled={busy} onClick={() => void create()}>
            New draft
          </button>
        )}
      </div>

      {error && <p role="alert" className="quotation-error">{error}</p>}

      {/* Context reference panel */}
      <QuotationContext item={item} services={services} onUseRate={useServiceRate} />

      {/* Draft editor */}
      {draft && (
        <>
          {/* Quotation preview — always on top */}
          <QuotationPreview base={base} lines={lines} />

          {/* Existing lines — editable */}
          {lines.length > 0 && (
            <ul className="quotation-line-list">
              {lines.map((line, index) => (
                <li key={line.localId} className="quotation-line-item">
                  <div className="quotation-line-item-fields">
                    <input
                      className="quotation-line-desc"
                      aria-label="Line description"
                      value={line.description}
                      placeholder="Description"
                      onChange={(e) =>
                        setLines((current) =>
                          current.map((entry, i) =>
                            i === index ? { ...entry, description: e.target.value } : entry,
                          ),
                        )
                      }
                    />
                    <div className="quotation-line-dir-toggle">
                      <button
                        type="button"
                        className={`quotation-dir-btn${line.direction === "add" ? " active-add" : ""}`}
                        aria-pressed={line.direction === "add"}
                        onClick={() =>
                          setLines((current) =>
                            current.map((entry, i) =>
                              i === index ? { ...entry, direction: "add" } : entry,
                            ),
                          )
                        }
                      >
                        + Add
                      </button>
                      <button
                        type="button"
                        className={`quotation-dir-btn${line.direction === "deduct" ? " active-deduct" : ""}`}
                        aria-pressed={line.direction === "deduct"}
                        onClick={() =>
                          setLines((current) =>
                            current.map((entry, i) =>
                              i === index ? { ...entry, direction: "deduct" } : entry,
                            ),
                          )
                        }
                      >
                        − Deduct
                      </button>
                    </div>
                    <input
                      className="quotation-line-amount"
                      aria-label="Amount in pesos"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={line.amountMinor > 0 ? line.amountMinor / 100 : ""}
                      onChange={(e) =>
                        setLines((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, amountMinor: Math.round(Number(e.target.value) * 100) }
                              : entry,
                          ),
                        )
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="quotation-line-remove"
                    aria-label="Remove line"
                    onClick={() =>
                      setLines((current) => current.filter((_, i) => i !== index))
                    }
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Add new line row */}
          <div className="quotation-add-row">
            <input
              className="quotation-line-desc"
              aria-label="New line description"
              value={newDesc}
              placeholder="Description"
              onChange={(e) => setNewDesc(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addLine(); }}
            />
            <div className="quotation-line-dir-toggle">
              <button
                type="button"
                className={`quotation-dir-btn${newDir === "add" ? " active-add" : ""}`}
                aria-pressed={newDir === "add"}
                onClick={() => setNewDir("add")}
              >
                + Add
              </button>
              <button
                type="button"
                className={`quotation-dir-btn${newDir === "deduct" ? " active-deduct" : ""}`}
                aria-pressed={newDir === "deduct"}
                onClick={() => setNewDir("deduct")}
              >
                − Deduct
              </button>
            </div>
            <input
              className="quotation-line-amount"
              aria-label="New line amount in pesos"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addLine(); }}
            />
            <button
              type="button"
              className="quotation-add-btn"
              onClick={addLine}
            >
              Add
            </button>
          </div>

          <div className="quotation-builder-actions">
            <button type="button" disabled={busy} onClick={() => void save()}>
              Save draft
            </button>
            <button type="button" disabled={busy} onClick={() => void send()}>
              Send quotation
            </button>
          </div>
        </>
      )}

      {quotes.length > 0 && (
        <details className="quotation-history">
          <summary>Version history</summary>
          <ul>
            {quotes.map((q) => (
              <li key={q.id}>
                v{q.version} · {q.status} · {money(q.totalAmountMinor)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
