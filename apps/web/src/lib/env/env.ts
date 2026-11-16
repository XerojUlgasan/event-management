type PublicEnv = {
  PUBLIC_API_URL?: string;
  PUBLIC_FIREBASE_API_KEY?: string;
  PUBLIC_FIREBASE_AUTH_DOMAIN?: string;
  PUBLIC_FIREBASE_PROJECT_ID?: string;
  PUBLIC_FIREBASE_STORAGE_BUCKET?: string;
  PUBLIC_FIREBASE_MESSAGING_SENDER_ID?: string;
  PUBLIC_FIREBASE_APP_ID?: string;
};

export function createPublicEnv(source: PublicEnv) {
  const firebaseConfig = {
    apiKey: source.PUBLIC_FIREBASE_API_KEY,
    authDomain: source.PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: source.PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: source.PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: source.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: source.PUBLIC_FIREBASE_APP_ID,
  };

  return {
    PUBLIC_API_URL: source.PUBLIC_API_URL ?? "http://localhost:3000/v1",
    firebaseConfig,
    firebaseConfigured: Boolean(
      firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId,
    ),
  };
}

// Explicit PUBLIC_* reads let Vite replace client settings at build time.
// Optional access also supports source imports in the Node test runner.
export const env = createPublicEnv({
  PUBLIC_API_URL: import.meta.env?.PUBLIC_API_URL,
  PUBLIC_FIREBASE_API_KEY: import.meta.env?.PUBLIC_FIREBASE_API_KEY,
  PUBLIC_FIREBASE_AUTH_DOMAIN: import.meta.env?.PUBLIC_FIREBASE_AUTH_DOMAIN,
  PUBLIC_FIREBASE_PROJECT_ID: import.meta.env?.PUBLIC_FIREBASE_PROJECT_ID,
  PUBLIC_FIREBASE_STORAGE_BUCKET: import.meta.env
    ?.PUBLIC_FIREBASE_STORAGE_BUCKET,
  PUBLIC_FIREBASE_MESSAGING_SENDER_ID: import.meta.env
    ?.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  PUBLIC_FIREBASE_APP_ID: import.meta.env?.PUBLIC_FIREBASE_APP_ID,
});
