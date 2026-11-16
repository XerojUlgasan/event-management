type EnvSource = Record<string, string | undefined>;

/** Read values on access so each consumer retains its existing initialization timing. */
export function createEnv(source: EnvSource) {
  function required(name: "DB_NAME" | "DB_USER" | "DB_PASSWORD") {
    const value = source[name];
    if (!value) throw new Error(`${name} is required`);
    return value;
  }

  function configured(name: string) {
    return source[name]?.trim() || undefined;
  }

  function storageKey() {
    const direct =
      configured("SUPABASE_SERVICE_ROLE_KEY") ??
      configured("SUPABASE_SECRET_KEY");
    if (direct) return direct;
    const raw = configured("SUPABASE_SECRET_KEYS");
    if (!raw) return undefined;
    try {
      const parsed: unknown = JSON.parse(raw);
      // Object.values also accepts arrays and primitive JSON values, as before.
      if (parsed === null || parsed === undefined) return undefined;
      const entries = Object.values(parsed);
      const candidate =
        (typeof parsed === "object" && "default" in parsed
          ? parsed.default
          : undefined) ?? entries[0];
      return typeof candidate === "string" && candidate.trim()
        ? candidate.trim()
        : undefined;
    } catch {
      return undefined;
    }
  }

  return {
    get API_PORT() {
      return Number(source.API_PORT ?? 3000);
    },
    get DB_HOST() {
      return source.DB_HOST ?? "localhost";
    },
    get DB_PORT() {
      return source.DB_PORT ?? "5432";
    },
    get DB_NAME() {
      return required("DB_NAME");
    },
    get DB_USER() {
      return required("DB_USER");
    },
    get DB_PASSWORD() {
      return required("DB_PASSWORD");
    },
    get WEB_ORIGINS() {
      return (source.WEB_ORIGIN ?? "http://localhost:4321")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    },
    get SESSION_TTL_MS() {
      const days = Number(source.SESSION_TTL_DAYS ?? 7);
      return (
        (Number.isFinite(days) && days > 0 ? days : 7) * 24 * 60 * 60 * 1000
      );
    },
    get NODE_ENV() {
      return source.NODE_ENV;
    },
    get FIREBASE_PROJECT_ID() {
      return source.FIREBASE_PROJECT_ID?.trim();
    },
    get FIREBASE_CLIENT_EMAIL() {
      return source.FIREBASE_CLIENT_EMAIL?.trim();
    },
    get FIREBASE_PRIVATE_KEY() {
      return source.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
    },
    get FIREBASE_AUTH_EMULATOR_HOST() {
      return source.FIREBASE_AUTH_EMULATOR_HOST;
    },
    get GOOGLE_APPLICATION_CREDENTIALS() {
      return source.GOOGLE_APPLICATION_CREDENTIALS;
    },
    get GOOGLE_CLOUD_PROJECT() {
      return source.GOOGLE_CLOUD_PROJECT;
    },
    get GCLOUD_PROJECT() {
      return source.GCLOUD_PROJECT;
    },
    get STORAGE() {
      const url = configured("SUPABASE_URL")?.replace(/\/$/, "");
      const apiKey = storageKey();
      const bucket =
        configured("SUPABASE_STORAGE_BUCKET") ?? "event-management";
      if (!url || !apiKey) throw new Error("Media storage is not configured");
      return { url, apiKey, bucket };
    },
    get SEED_CLOCK() {
      return source.SEED_CLOCK;
    },
    get SEED_RANDOM_SEED() {
      return source.SEED_RANDOM_SEED ?? "clemora-scenario-v1";
    },
    get ADMIN_EMAIL() {
      return source.ADMIN_EMAIL;
    },
    get ADMIN_PASSWORD() {
      return source.ADMIN_PASSWORD;
    },
  };
}

export const env = createEnv(process.env);
