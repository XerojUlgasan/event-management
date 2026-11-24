const firebaseConfig = {
  apiKey: import.meta.env?.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env?.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env?.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env?.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env?.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env?.PUBLIC_FIREBASE_APP_ID,
};

const defaultServerApiUrl = "http://127.0.0.1:3000/v1";

function readServerSetting(name: "API_PROXY_TARGET" | "PUBLIC_API_URL") {
  // Vite sets SSR for app modules. Astro config also imports this before Vite.
  if (import.meta.env?.SSR === false)
    throw new Error("Server configuration is unavailable in the browser");

  return process.env[name];
}

export const config = {
  // Explicit PUBLIC_* reads are replaced by Vite at build time.
  PUBLIC_API_URL: (
    import.meta.env?.PUBLIC_API_URL ?? "http://localhost:3000/v1"
  ).replace(/\/$/, ""),
  PUBLIC_SUPABASE_URL: import.meta.env?.PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY: import.meta.env
    ?.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  firebaseConfig,
  firebaseConfigured: Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId,
  ),
  get API_PROXY_TARGET() {
    return readServerSetting("API_PROXY_TARGET");
  },
  get SERVER_API_URL() {
    const proxy = readServerSetting("API_PROXY_TARGET")?.replace(/\/$/, "");

    if (proxy) return `${proxy}/functions/v1/api/v1`;

    const publicApiUrl = readServerSetting("PUBLIC_API_URL");

    if (publicApiUrl && /^https?:\/\//.test(publicApiUrl))
      return publicApiUrl.replace(/\/$/, "");

    return defaultServerApiUrl;
  },
};
