import { Tabs } from "@event-management/ui";
import { navigateWorkspace } from "../../../../lib/navigation/workspace-navigation";
import { adminAiPaths, type AdminAiSection } from "../../../app/routes";
import { AgentSettingsPage } from "./AgentSettingsPage";
import { KnowledgePage } from "./KnowledgePage";
import { SupportingDocumentsPage } from "./SupportingDocumentsPage";
import "../../../../styles/ai/ai-workspace.css";

const sections: { value: AdminAiSection; label: string }[] = [
  { value: "agent", label: "Agent" },
  { value: "knowledge", label: "Knowledge Catalog" },
  { value: "documents", label: "Supporting Documents" },
];

export function AiPage({ section }: { section: AdminAiSection }) {
  return (
    <div className="ai-workspace">
      <Tabs
        role="tablist"
        aria-label="AI"
        active={section}
        onChange={(value) => {
          if (
            value === "agent" ||
            value === "knowledge" ||
            value === "documents"
          )
            navigateWorkspace(adminAiPaths[value]);
        }}
        items={sections.map((item) => ({
          ...item,
          id: `ai-tab-${item.value}`,
          panelId: `ai-panel-${item.value}`,
        }))}
      />
      <div
        role="tabpanel"
        id="ai-panel-agent"
        aria-labelledby="ai-tab-agent"
        hidden={section !== "agent"}
      >
        <AgentSettingsPage />
      </div>
      {section !== "agent" && (
        <div
          role="tabpanel"
          id={`ai-panel-${section}`}
          aria-labelledby={`ai-tab-${section}`}
        >
          {section === "knowledge" ? (
            <KnowledgePage />
          ) : (
            <SupportingDocumentsPage />
          )}
        </div>
      )}
    </div>
  );
}
