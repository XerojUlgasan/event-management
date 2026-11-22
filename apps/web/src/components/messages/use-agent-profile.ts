import { useEffect, useState } from "react";
import {
  defaultAgentSettings,
  type AgentProfile,
} from "@event-management/contracts/ai-agent-settings";
import { getAgentProfile } from "../../lib/data/ai/agent-settings";

export function useAgentProfile(visible = true) {
  const [profile, setProfile] = useState<AgentProfile>({
    displayName: defaultAgentSettings.displayName,
    greeting: null,
  });
  useEffect(() => {
    if (!visible) return;

    let active = true;
    void getAgentProfile()
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [visible]);

  return {
    ...profile,
    senderLabel: /\bAI$/i.test(profile.displayName)
      ? profile.displayName
      : `${profile.displayName} · AI assistant`,
  };
}
