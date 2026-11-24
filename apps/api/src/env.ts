function required(name: "DB_NAME" | "DB_USER" | "DB_PASSWORD") {
  const value = process.env[name];

  if (!value) throw new Error(`${name} is required`);

  return value;
}

function configured(name: string) {
  return process.env[name]?.trim() || undefined;
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

function localRealtimeSecret() {
  const secret = configured("REALTIME_JWT_SECRET");
  const target = configured("SUPABASE_URL");

  if (!secret || !target || process.env.NODE_ENV === "production")
    return undefined;

  try {
    const url = new URL(target);

    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;

    const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      url.hostname,
    );
    const isLocalEdgeGateway = url.origin === "http://kong:8000";

    return isLoopback || isLocalEdgeGateway ? secret : undefined;
  } catch {
    return undefined;
  }
}

/** Read settings on access to preserve runtime initialization timing. */
export const config = {
  get API_PORT() {
    return Number(process.env.API_PORT ?? 3000);
  },
  get DB_HOST() {
    return process.env.DB_HOST ?? "localhost";
  },
  get DB_PORT() {
    return process.env.DB_PORT ?? "5432";
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
    return (process.env.WEB_ORIGIN ?? "http://localhost:4321")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  },
  get SESSION_TTL_MS() {
    const days = Number(process.env.SESSION_TTL_DAYS ?? 7);

    return (Number.isFinite(days) && days > 0 ? days : 7) * 24 * 60 * 60 * 1000;
  },
  get NODE_ENV() {
    return process.env.NODE_ENV;
  },
  get FIREBASE_ADMIN() {
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(
      /\\n/g,
      "\n",
    ).trim();
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (process.env.FIREBASE_AUTH_EMULATOR_HOST && projectId)
      return { kind: "emulator", projectId } as const;

    if (projectId && clientEmail && privateKey)
      return {
        kind: "serviceAccount",
        projectId,
        clientEmail,
        privateKey,
      } as const;

    if (credentialsPath)
      return { kind: "file", credentialsPath, projectId } as const;

    if (process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT)
      return { kind: "applicationDefault", projectId } as const;

    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY (or GOOGLE_APPLICATION_CREDENTIALS) in apps/api/.env.",
    );
  },
  get STORAGE() {
    const url = configured("SUPABASE_URL")?.replace(/\/$/, "");
    const apiKey = storageKey();
    const bucket = configured("SUPABASE_STORAGE_BUCKET") ?? "event-management";

    if (!url || !apiKey) throw new Error("Media storage is not configured");

    return { url, apiKey, bucket };
  },
  get REALTIME_SIGNING() {
    const jwk = configured("REALTIME_JWT_SIGNING_JWK");

    if (jwk) return { algorithm: "ES256", jwk } as const;

    const secret = localRealtimeSecret();

    if (secret) return { algorithm: "HS256", secret } as const;
  },
  get AI_TEXT() {
    const apiKey = configured("AI_GATEWAY_API_KEY");
    const model = configured("TEXT_MODEL");

    if (!apiKey || !model) throw new Error("AI text model is not configured");

    return { apiKey, model };
  },
  get AI_VISION() {
    const apiKey = configured("AI_GATEWAY_API_KEY");
    const model = configured("VISION_MODEL");

    if (!apiKey || !model) throw new Error("AI vision model is not configured");

    return { apiKey, model };
  },
  get AI_EMBEDDING() {
    const apiKey = configured("AI_GATEWAY_API_KEY");
    const model = configured("EMBEDDING_MODEL");

    if (!apiKey || !model)
      throw new Error("AI embedding model is not configured");

    return { apiKey, model };
  },
  get SEED_CLOCK() {
    return process.env.SEED_CLOCK;
  },
  get SEED_RANDOM_SEED() {
    return process.env.SEED_RANDOM_SEED ?? "clemora-scenario-v1";
  },
  get ADMIN_EMAIL() {
    return process.env.ADMIN_EMAIL;
  },
  get ADMIN_PASSWORD() {
    return process.env.ADMIN_PASSWORD;
  },
};
