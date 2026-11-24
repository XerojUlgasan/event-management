import { config } from "../../src/env.js";

export function setTestConfig(settings: Partial<typeof config>) {
  Object.assign(config, settings);

  for (const [name, value] of Object.entries(settings)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

export function testDatabaseUrl(database: string) {
  const {
    DB_HOST: host = "localhost",
    DB_PORT: port = "5432",
    DB_USER: user,
    DB_PASSWORD: password,
  } = process.env;

  if (!user || !password)
    throw new Error("Test database credentials are required");

  const urlHost = host === "::1" ? "[::1]" : host;

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${urlHost}:${port}/${encodeURIComponent(database)}`;
}
