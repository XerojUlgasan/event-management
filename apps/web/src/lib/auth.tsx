import { Button } from "@event-management/ui"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  addPassword,
  ApiError,
  endSession,
  getMe,
  linkFirebase,
  login,
  register,
  syncSession,
} from "./api";
import type { Profile } from "./api";

type Status = "loading" | "signed-out" | "signed-in";
type FirebaseMethod = "google" | "password";
export const firebaseConfigured = Boolean(
  import.meta.env.PUBLIC_FIREBASE_API_KEY &&
  import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN &&
  import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
);

type AuthContextValue = {
  status: Status;
  profile: Profile | null;
  error: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFirebase: (email: string, password: string) => Promise<void>;
  connectFirebase: (
    currentPassword: string,
    method: FirebaseMethod,
    email?: string,
    password?: string,
  ) => Promise<void>;
  createPassword: (
    password: string,
    method: FirebaseMethod,
    email?: string,
    firebasePassword?: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function messageFor(error: unknown) {
  switch ((error as { code?: string }).code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Google sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Allow popups and try Google sign-in again.";
    case "auth/account-exists-with-different-credential":
      return "Use the existing Firebase sign-in method for this email.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return error instanceof Error
        ? error.message
        : "Something went wrong. Try again.";
  }
}

async function withFirebase<T>(
  method: FirebaseMethod,
  task: (idToken: string) => Promise<T>,
  email?: string,
  password?: string,
) {
  if (!firebaseConfigured)
    throw new Error("Firebase sign-in is currently unavailable.");
  const [client, sdk] = await Promise.all([
    import("./firebase"),
    import("firebase/auth"),
  ]);
  await client.firebaseReady;
  try {
    const credential =
      method === "google"
        ? await sdk.signInWithPopup(client.firebaseAuth, client.googleProvider)
        : await sdk.signInWithEmailAndPassword(
            client.firebaseAuth,
            email ?? "",
            password ?? "",
          );
    return await task(await credential.user.getIdToken(true));
  } finally {
    // Firebase proves identity; only the API cookie keeps the app signed in.
    await sdk.signOut(client.firebaseAuth).catch(() => {});
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const operation = useRef(0);

  useEffect(() => {
    const current = ++operation.current;
    let active = true;
    void getMe()
      .then((nextProfile) => {
        if (!active || current !== operation.current) return;
        setProfile(nextProfile);
        setStatus("signed-in");
      })
      .catch((cause) => {
        if (!active || current !== operation.current) return;
        if (!(cause instanceof ApiError && cause.status === 401))
          setError(messageFor(cause));
        setStatus("signed-out");
      });
    return () => {
      active = false;
    };
  }, []);

  const run = useCallback(async (task: () => Promise<Profile | null>) => {
    const current = ++operation.current;
    setError("");
    try {
      const nextProfile = await task();
      if (current !== operation.current) return;
      setProfile(nextProfile);
      setStatus(nextProfile ? "signed-in" : "signed-out");
    } catch (cause) {
      if (current === operation.current) setError(messageFor(cause));
      throw cause;
    }
  }, []);

  const signIn = (email: string, password: string) =>
    run(() => login(email, password));
  const signUp = (name: string, email: string, password: string) =>
    run(() => register(name, email, password));
  const signInWithGoogle = () => run(() => withFirebase("google", syncSession));
  const signInWithFirebase = (email: string, password: string) =>
    run(() => withFirebase("password", syncSession, email, password));
  const connectFirebase: AuthContextValue["connectFirebase"] = (
    currentPassword,
    method,
    email,
    password,
  ) =>
    run(() =>
      withFirebase(
        method,
        (token) => linkFirebase(token, currentPassword),
        email,
        password,
      ),
    );
  const createPassword: AuthContextValue["createPassword"] = (
    password,
    method,
    email,
    firebasePassword,
  ) =>
    run(() =>
      withFirebase(
        method,
        (token) => addPassword(token, password),
        email,
        firebasePassword,
      ),
    );
  const signOut = () =>
    run(async () => {
      await endSession();
      return null;
    });
  const clearError = useCallback(() => setError(""), []);

  return (
    <AuthContext.Provider
      value={{
        status,
        profile,
        error,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithFirebase,
        connectFirebase,
        createPassword,
        signOut,
        clearError,
      }}
    >
      {status === "signed-in" && error && (
        <div className="auth-status-error" role="alert">
          <span>{error}</span>
          <Button variant="secondary" type="button" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
