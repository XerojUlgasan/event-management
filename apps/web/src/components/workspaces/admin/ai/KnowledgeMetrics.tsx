import { Button, Panel } from "@event-management/ui";
import type { KnowledgeSummary } from "@event-management/contracts/catalog-knowledge";
import { KnowledgeHelp, knowledgeCoverageHelp } from "./KnowledgeDisplay";

// KPI tiles compose Panel because StatCard requires an unrelated menu and detail.
function Metric({
  label,
  indexed,
  total,
  attention,
  selected,
  onClick,
}: {
  label: string;
  indexed: number;
  total: number;
  attention?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const ratio = total ? indexed / total : 0;
  return (
    <Panel
      className={`knowledge-metric${attention && indexed ? " knowledge-metric-alert" : ""}${selected ? " knowledge-metric-selected" : ""}`}
    >
      <div className="knowledge-metric-label">
        {label}{" "}
        <KnowledgeHelp
          text={
            attention
              ? "Eligible listings that are partial, pending, or need refresh. Select to filter the table."
              : knowledgeCoverageHelp
          }
        />
      </div>
      {onClick ? (
        <Button
          variant="plain"
          className="knowledge-metric-button"
          aria-pressed={selected}
          onClick={onClick}
        >
          <strong>{indexed}</strong>
          <span> / {total}</span>
        </Button>
      ) : (
        <div className="knowledge-metric-value">
          <strong>{total ? `${(ratio * 100).toFixed(1)}%` : "—"}</strong>
          <span>
            {indexed} / {total}
          </span>
        </div>
      )}
      <div className="knowledge-target">
        <span>Target {attention ? "0" : "100%"}</span>
      </div>
      <div className="knowledge-track" aria-hidden="true">
        <span style={{ width: `${ratio * 100}%` }} />
      </div>
    </Panel>
  );
}

export function KnowledgeMetrics({
  summary,
  status,
  onStatusChange,
}: {
  summary: KnowledgeSummary;
  status: string;
  onStatusChange: (status: string) => void;
}) {
  return (
    <>
      <div className="knowledge-overview-heading">
        All eligible catalog{" "}
        <KnowledgeHelp text="These totals cover all eligible listings and do not change with table filters." />
      </div>
      <div className="knowledge-metrics">
        <Metric
          label="Packages indexed"
          indexed={summary.packages.indexed}
          total={summary.packages.total}
        />
        <Metric
          label="Services indexed"
          indexed={summary.services.indexed}
          total={summary.services.total}
        />
        <Metric
          label="Needs attention"
          indexed={summary.attention}
          total={summary.total}
          attention
          selected={status === "attention"}
          onClick={() =>
            onStatusChange(status === "attention" ? "" : "attention")
          }
        />
      </div>
    </>
  );
}
