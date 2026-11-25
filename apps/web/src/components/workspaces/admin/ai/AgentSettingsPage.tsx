import { useEffect, useState, type SubmitEvent } from "react";
import { Button, Panel, useNotifications } from "@event-management/ui";
import {
  defaultAgentSettings,
  type AgentSettings,
  type AgentSettingsResponse,
} from "@event-management/contracts/ai-agent-settings";
import {
  getAgentSettings,
  publishAgentSettings,
} from "../../../../lib/data/ai/agent-settings";
import { ApiError } from "../../../../lib/http/request";
import {
  AgentSettingsFields,
  agentPersonalityLabels,
} from "./AgentSettingsFields";
import { AgentTestDialog } from "./AgentTestDialog";
import "../../../../styles/ai/agent-settings.css";

export function AgentSettingsPage() {
  const { notify, notifyError } = useNotifications();
  const [settings, setSettings] = useState<AgentSettings>(defaultAgentSettings);
  const [published, setPublished] = useState<AgentSettingsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [displayNameError, setDisplayNameError] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError("");

    try {
      const result = await getAgentSettings();
      setPublished(result);
      setSettings(result.settings);
    } catch (error) {
      setLoadError("Could not load agent settings.");
      notifyError(error, "Could not load agent settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const update = <K extends keyof AgentSettings>(
    key: K,
    value: AgentSettings[K],
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
    if (key === "displayName") setDisplayNameError("");
  };

  const dirty =
    published &&
    JSON.stringify(settings) !== JSON.stringify(published.settings);

  const save = async (event: SubmitEvent) => {
    event.preventDefault();

    if (!published) return;

    if (!settings.displayName.trim()) {
      setDisplayNameError("A display name is required.");
      return;
    }

    setDisplayNameError("");

    setSaving(true);
    setSaveError("");
    setConflict(false);

    try {
      const result = await publishAgentSettings(settings, published.revision);
      setPublished(result);
      setSettings(result.settings);
      notify("Agent settings published.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        try {
          const latest = await getAgentSettings();
          setPublished(latest);
          setConflict(true);
          setSaveError(
            "Settings changed elsewhere. Your edits are still here. Review them and publish again to replace the latest version.",
          );
        } catch {
          setSaveError(
            "Settings changed elsewhere. Your edits are still here, but the latest version could not be loaded. Try publishing again later.",
          );
        }
      } else {
        setSaveError("Could not publish. Your edits are still here.");
        notifyError(error, "Could not publish agent settings.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading agent settings…</p>;

  if (loadError || !published)
    return (
      <div role="alert">
        <p>{loadError}</p>
        <Button variant="secondary" size="small" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );

  return (
    <>
      <form className="agent-settings" onSubmit={(event) => void save(event)}>
        <Panel
          title="Agent settings"
          action={
            <div className="agent-actions">
              <Button
                variant="secondary"
                size="icon"
                icon="message"
                aria-label="Test chat"
                title="Test chat"
                disabled={previewBusy}
                onClick={() => setTesting(true)}
              />
              <Button
                type="submit"
                size="small"
                pending={saving}
                disabled={!dirty}
              >
                {saving ? "Publishing…" : "Publish"}
              </Button>
            </div>
          }
        >
          <fieldset
            className="agent-fields"
            disabled={saving}
            aria-label="Agent settings"
          >
            <AgentSettingsFields
              settings={settings}
              onChange={update}
              displayNameError={displayNameError}
            />
            {saveError && <p role="alert">{saveError}</p>}
            {conflict && (
              <details>
                <summary>View latest published settings</summary>
                <dl>
                  <dt>Display name</dt>
                  <dd>{published.settings.displayName}</dd>
                  <dt>Greeting</dt>
                  <dd>{published.settings.greeting || "None"}</dd>
                  <dt>Personality</dt>
                  <dd>
                    {agentPersonalityLabels[published.settings.personality]}
                  </dd>
                  <dt>Additional instructions</dt>
                  <dd>{published.settings.additionalInstructions || "None"}</dd>
                  <dt>Capabilities</dt>
                  <dd>
                    Business information{" "}
                    {published.settings.allowBusinessInformation ? "On" : "Off"}
                    {" · "}Public catalog{" "}
                    {published.settings.allowPublicCatalog ? "On" : "Off"}
                  </dd>
                </dl>
              </details>
            )}
            {dirty && <small>Unpublished changes</small>}
          </fieldset>
        </Panel>
      </form>
      {testing && (
        <AgentTestDialog
          settings={settings}
          onClose={() => setTesting(false)}
          busy={previewBusy}
          onBusyChange={setPreviewBusy}
        />
      )}
    </>
  );
}
