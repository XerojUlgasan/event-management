import "dotenv/config";

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const host = process.env.DB_HOST ?? "localhost";
const port = process.env.DB_PORT ?? "5432";
const database = encodeURIComponent(required("DB_NAME"));
const user = encodeURIComponent(required("DB_USER"));
const password = encodeURIComponent(required("DB_PASSWORD"));

export const databaseUrl = `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`;
