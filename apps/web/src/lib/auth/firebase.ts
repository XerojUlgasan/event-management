import { getApp, getApps, initializeApp } from "firebase/app";
import { config } from "../../env";
import {
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  setPersistence,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: config.PUBLIC_FIREBASE_API_KEY,
  authDomain: config.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: config.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: config.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: config.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: config.PUBLIC_FIREBASE_APP_ID,
};

// Imported only when the user chooses a Firebase sign-in method.
const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);

export const googleProvider = new GoogleAuthProvider();

export const firebaseReady = setPersistence(firebaseAuth, inMemoryPersistence);

googleProvider.setCustomParameters({ prompt: "select_account" });
