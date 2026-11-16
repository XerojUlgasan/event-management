import { getApp, getApps, initializeApp } from "firebase/app";
import { env } from "../env/env";
import {
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  setPersistence,
} from "firebase/auth";

const firebaseConfig = env.firebaseConfig;

// Imported only when the user chooses a Firebase sign-in method.
const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
export const firebaseReady = setPersistence(firebaseAuth, inMemoryPersistence);
googleProvider.setCustomParameters({ prompt: "select_account" });
