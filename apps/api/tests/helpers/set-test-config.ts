import { config } from "../../src/env.js";

// Some fixtures also pass settings to gateway SDKs or child processes.
export function setTestConfig(settings: Partial<typeof config>) {
  Object.assign(config, settings);

  for (const [name, value] of Object.entries(settings)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
