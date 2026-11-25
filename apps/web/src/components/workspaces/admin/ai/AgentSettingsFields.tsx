import {
  agentPersonalities,
  agentSettingsLimits,
  type AgentSettings,
} from "@event-management/contracts/ai-agent-settings";
import { FormField, Input, Textarea } from "@event-management/ui";

export const agentPersonalityLabels = {
  professional: "Professional",
  friendly: "Friendly",
  warm_concise: "Warm & concise",
} satisfies Record<AgentSettings["personality"], string>;

export function AgentSettingsFields({
  settings,
  onChange,
  displayNameError,
}: {
  settings: AgentSettings;
  onChange: <K extends keyof AgentSettings>(
    key: K,
    value: AgentSettings[K],
  ) => void;
  displayNameError?: string;
}) {
  return (
    <>
      <FormField label="Display name" error={displayNameError}>
        {(props) => (
          <Input
            {...props}
            required
            maxLength={agentSettingsLimits.displayName}
            value={settings.displayName}
            onChange={(event) => onChange("displayName", event.target.value)}
          />
        )}
      </FormField>
      <FormField
        label="Greeting"
        description="Shown at the start of public chat."
      >
        {(props) => (
          <Textarea
            {...props}
            className="agent-greeting"
            maxLength={agentSettingsLimits.greeting}
            rows={1}
            value={settings.greeting ?? ""}
            onChange={(event) =>
              onChange("greeting", event.target.value || null)
            }
          />
        )}
      </FormField>
      <fieldset className="agent-personality">
        <legend>Personality</legend>
        <div className="agent-personality-options">
          {agentPersonalities.map((personality) => (
            <label key={personality}>
              <Input
                variant="plain"
                type="radio"
                name="personality"
                value={personality}
                checked={settings.personality === personality}
                onChange={() => onChange("personality", personality)}
              />
              <span>{agentPersonalityLabels[personality]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <FormField label="Additional instructions">
        {(props) => (
          <Textarea
            {...props}
            maxLength={agentSettingsLimits.additionalInstructions}
            rows={3}
            placeholder="For example, ask about the venue once the date is known."
            value={settings.additionalInstructions}
            onChange={(event) =>
              onChange("additionalInstructions", event.target.value)
            }
          />
        )}
      </FormField>
      <fieldset className="agent-capabilities">
        <legend>Capabilities</legend>
        <label>
          <Input
            variant="plain"
            type="checkbox"
            checked={settings.allowBusinessInformation}
            onChange={(event) =>
              onChange("allowBusinessInformation", event.target.checked)
            }
          />{" "}
          Look up business information
        </label>
        <label>
          <Input
            variant="plain"
            type="checkbox"
            checked={settings.allowPublicCatalog}
            onChange={(event) =>
              onChange("allowPublicCatalog", event.target.checked)
            }
          />{" "}
          Search packages and services
        </label>
      </fieldset>
    </>
  );
}
