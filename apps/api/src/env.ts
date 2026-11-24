/** Read configuration on access so optional integrations do not block startup. */
function required(name: string) {
  const value = process.env[name];

  if (!value || !value.trim()) throw new Error(`${name} is required`);

  return value;
}

function optional(name: string) {
  return process.env[name]?.trim() || undefined;
}

function storageKey() {
  const serviceRole = optional("SUPABASE_SERVICE_ROLE_KEY");

  if (serviceRole) return serviceRole;

  const secret = optional("SUPABASE_SECRET_KEY");

  if (secret) return secret;

  const raw = optional("SUPABASE_SECRET_KEYS");

  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);

      if (parsed !== null && parsed !== undefined) {
        const entries = Object.values(parsed);
        let candidate: unknown = entries[0];

        if (
          typeof parsed === "object" &&
          "default" in parsed &&
          parsed.default !== null &&
          parsed.default !== undefined
        )
          candidate = parsed.default;

        if (typeof candidate === "string" && candidate.trim())
          return candidate.trim();
      }
    } catch {
      // Report the key name below without exposing its value.
    }
  }

  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY or SUPABASE_SECRET_KEYS is required",
  );
}

function localRealtimeSecret() {
  const secret = optional("REALTIME_JWT_SECRET");
  const target = optional("SUPABASE_URL");

  if (!secret || !target || process.env.NODE_ENV === "production")
    return undefined;

  try {
    const url = new URL(target);

    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;

    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

    return local || url.origin === "http://kong:8000" ? secret : undefined;
  } catch {
    return undefined;
  }
}

function model(name: string) {
  required("AI_GATEWAY_API_KEY");

  return required(name).trim();
}

export const config = {
  get API_PORT() {
    return Number(required("API_PORT"));
  },
  get DB_HOST() {
    return required("DB_HOST");
  },
  get DB_PORT() {
    return required("DB_PORT");
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
  get WEB_ORIGIN() {
    return required("WEB_ORIGIN")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  },
  get SESSION_TTL_DAYS() {
    const days = Number(required("SESSION_TTL_DAYS"));

    if (!Number.isFinite(days) || days <= 0)
      throw new Error("SESSION_TTL_DAYS must be a positive number");

    return days;
  },
  get NODE_ENV() {
    return process.env.NODE_ENV;
  },
  get FIREBASE_PROJECT_ID() {
    return optional("FIREBASE_PROJECT_ID");
  },
  get FIREBASE_CLIENT_EMAIL() {
    return optional("FIREBASE_CLIENT_EMAIL");
  },
  get FIREBASE_PRIVATE_KEY() {
    return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  },
  get FIREBASE_AUTH_EMULATOR_HOST() {
    return process.env.FIREBASE_AUTH_EMULATOR_HOST;
  },
  get GOOGLE_APPLICATION_CREDENTIALS() {
    return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  },
  get GOOGLE_CLOUD_PROJECT() {
    return process.env.GOOGLE_CLOUD_PROJECT;
  },
  get GCLOUD_PROJECT() {
    return process.env.GCLOUD_PROJECT;
  },
  get SUPABASE_URL() {
    return required("SUPABASE_URL").trim().replace(/\/$/, "");
  },
  get SUPABASE_STORAGE_KEY() {
    return storageKey();
  },
  get STORAGE_BUCKET() {
    return required("STORAGE_BUCKET").trim();
  },
  get REALTIME_JWT_SIGNING_JWK() {
    return optional("REALTIME_JWT_SIGNING_JWK");
  },
  get REALTIME_JWT_SECRET() {
    return localRealtimeSecret();
  },
  get AI_GATEWAY_API_KEY() {
    return required("AI_GATEWAY_API_KEY").trim();
  },
  get TEXT_MODEL() {
    return model("TEXT_MODEL");
  },
  get VISION_MODEL() {
    return model("VISION_MODEL");
  },
  get EMBEDDING_MODEL() {
    return model("EMBEDDING_MODEL");
  },
  get SEED_CLOCK() {
    return process.env.SEED_CLOCK;
  },
  get SEED_RANDOM_SEED() {
    return required("SEED_RANDOM_SEED");
  },
  get ADMIN_EMAIL() {
    return process.env.ADMIN_EMAIL;
  },
  get ADMIN_PASSWORD() {
    return process.env.ADMIN_PASSWORD;
  },
};
