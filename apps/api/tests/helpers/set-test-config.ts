import { config } from "../../src/env.js";

export function setTestConfig(settings: Partial<typeof config>) {
  Object.assign(config, settings);

  for (const [name, value] of Object.entries(settings)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
