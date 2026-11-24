declare const __CLEMORA_DEV_PROXY_TARGET__: string | undefined;

function viteSsr(): boolean | undefined {
  // Vite substitutes this property. Plain Node has no import.meta.env.
  try {
    return import.meta.env.SSR;
  } catch {
    return undefined;
  }
}

const ssr = viteSsr();

const publicSettings =
  ssr === undefined
    ? {}
    : {
        PUBLIC_SUPABASE_URL: import.meta.env.PUBLIC_SUPABASE_URL,
        PUBLIC_SUPABASE_PUBLISHABLE_KEY: import.meta.env
          .PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        PUBLIC_FIREBASE_API_KEY: import.meta.env.PUBLIC_FIREBASE_API_KEY,
        PUBLIC_FIREBASE_AUTH_DOMAIN: import.meta.env
          .PUBLIC_FIREBASE_AUTH_DOMAIN,
        PUBLIC_FIREBASE_PROJECT_ID: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
        PUBLIC_FIREBASE_STORAGE_BUCKET: import.meta.env
          .PUBLIC_FIREBASE_STORAGE_BUCKET,
        PUBLIC_FIREBASE_MESSAGING_SENDER_ID: import.meta.env
          .PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        PUBLIC_FIREBASE_APP_ID: import.meta.env.PUBLIC_FIREBASE_APP_ID,
      };

const firebaseConfig = {
  apiKey: publicSettings.PUBLIC_FIREBASE_API_KEY,
  authDomain: publicSettings.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: publicSettings.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: publicSettings.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: publicSettings.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: publicSettings.PUBLIC_FIREBASE_APP_ID,
};

export const config = {
  ...publicSettings,
  firebaseConfig,
  firebaseConfigured: Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId,
  ),
  get PUBLIC_API_URL(): string {
    const url =
      ssr === undefined
        ? process.env.PUBLIC_API_URL
        : import.meta.env.PUBLIC_API_URL;

    if (!url) throw new Error("Missing environment variable: PUBLIC_API_URL");

    return url;
  },
  get API_PROXY_TARGET(): string | undefined {
    if (ssr === false) return undefined;

    if (typeof __CLEMORA_DEV_PROXY_TARGET__ !== "undefined")
      return __CLEMORA_DEV_PROXY_TARGET__;

    return process.env.API_PROXY_TARGET;
  },
  get API_PROXY_URL(): string | undefined {
    const configured = this.API_PROXY_TARGET;

    if (!configured) return undefined;

    const target = new URL(configured);
    const path = target.pathname.replace(/\/+$/, "") || "/functions/v1/api";

    return `${target.origin}${path.endsWith("/v1") ? path : `${path}/v1`}`;
  },
  get SERVER_API_URL(): string {
    const proxy = this.API_PROXY_URL;

    if (proxy) return proxy;

    const url = this.PUBLIC_API_URL;

    if (!/^https?:\/\//.test(url))
      throw new Error("Missing environment variable: API_PROXY_TARGET");

    return url.replace(/\/$/, "");
  },
};
