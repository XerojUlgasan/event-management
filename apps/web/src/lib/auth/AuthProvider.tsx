import { Button, useNotifications } from "@event-management/ui";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { ApiError } from "../http/request";
import { config } from "../../env";
import {
  addPassword,
  endSession,
  getMe,
  linkFirebase,
  login,
  register,
  syncSession,
  updatePassword,
} from "../data/auth/session";
import type { Profile } from "../data/auth/session";

type Status = "loading" | "signed-out" | "signed-in";

type FirebaseMethod = "google" | "password";

export const firebaseConfigured = Boolean(
  config.PUBLIC_FIREBASE_API_KEY &&
  config.PUBLIC_FIREBASE_AUTH_DOMAIN &&
  config.PUBLIC_FIREBASE_PROJECT_ID,
);

type AuthContextValue = {
  status: Status;
  profile: Profile | null;
  error: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFirebase: (email: string, password: string) => Promise<void>;
  connectGoogle: (currentPassword: string) => Promise<void>;
  createPassword: (
    password: string,
    method: FirebaseMethod,
    email?: string,
    firebasePassword?: string,
  ) => Promise<void>;
  changePassword: (currentPassword: string, password: string) => Promise<void>;
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
  const { notify, notifyError } = useNotifications();
  const pendingPasswordChange = useRef<Promise<void> | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const operation = useRef(0);
  const statusRef = useRef(status);
  statusRef.current = status;
  const probe = useRef<Promise<void> | null>(null);
  const authBusy = useRef(false);
  const probeFailure = useRef(false);

  useEffect(() => {
    try {
      const notice = sessionStorage.getItem("clemora-auth-notice");
      sessionStorage.removeItem("clemora-auth-notice");

      if (notice === "signin") notify("Signed in successfully.");

      if (notice === "register")
        notify("Account created. You are now signed in.");

      if (notice === "signout") notify("Signed out successfully.");
    } catch {
      /* Authentication still works when browser storage is unavailable. */
    }
  }, [notify]);

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

        if (!(cause instanceof ApiError && cause.status === 401)) {
          setError(notifyError(messageFor(cause)));
        }

        setStatus("signed-out");
      });

    return () => {
      active = false;
    };
  }, [notifyError]);

  useEffect(() => {
    let active = true;

    const revalidate = () => {
      if (
        statusRef.current !== "signed-in" ||
        probe.current ||
        authBusy.current
      )
        return;

      const current = operation.current;

      const pending = getMe()
        .then((nextProfile) => {
          if (!active || current !== operation.current) return;

          setProfile(nextProfile);
          probeFailure.current = false;
        })
        .catch((cause) => {
          if (!active || current !== operation.current) return;

          if (cause instanceof ApiError && cause.status === 401) {
            ++operation.current;
            setProfile(null);
            setStatus("signed-out");
          } else if (!probeFailure.current) {
            probeFailure.current = true;
            notifyError(
              cause,
              "Unable to check your session. Please try again.",
            );
          }
        })
        .finally(() => {
          if (probe.current === pending) probe.current = null;
        });

      probe.current = pending;
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") revalidate();
    };

    window.addEventListener("clemora:session-check", revalidate);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      window.removeEventListener("clemora:session-check", revalidate);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [notifyError]);

  const run = useCallback(
    async (
      task: () => Promise<Profile | null>,
      notice?: "signin" | "register" | "signout",
    ) => {
      const current = ++operation.current;
      authBusy.current = true;
      probe.current = null;
      setError("");
      let checkSession = false;

      try {
        const nextProfile = await task();

        if (current !== operation.current) return;

        if (notice) {
          try {
            sessionStorage.setItem("clemora-auth-notice", notice);
          } catch {
            /* The destination page itself still confirms the new session. */
          }
        }

        setProfile(nextProfile);
        setStatus(nextProfile ? "signed-in" : "signed-out");
      } catch (cause) {
        if (current === operation.current) {
          checkSession =
            cause instanceof ApiError &&
            cause.status === 401 &&
            statusRef.current === "signed-in";
          setError(notifyError(messageFor(cause)));
        }

        throw cause;
      } finally {
        if (current === operation.current) {
          authBusy.current = false;

          if (checkSession)
            window.dispatchEvent(new Event("clemora:session-check"));
        }
      }
    },
    [notifyError],
  );

  const signIn = (email: string, password: string) =>
    run(() => login(email, password), "signin");

  const signUp = (name: string, email: string, password: string) =>
    run(() => register(name, email, password), "register");

  const signInWithGoogle = () =>
    run(() => withFirebase("google", syncSession), "signin");

  const signInWithFirebase = (email: string, password: string) =>
    run(() => withFirebase("password", syncSession, email, password), "signin");

  const connectGoogle: AuthContextValue["connectGoogle"] = (currentPassword) =>
    run(() =>
      withFirebase("google", (token) => linkFirebase(token, currentPassword)),
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

  const changePassword: AuthContextValue["changePassword"] = async (
    currentPassword,
    password,
  ) => {
    const pending = run(() => updatePassword(currentPassword, password));

    pendingPasswordChange.current = pending;

    try {
      await pending;
    } finally {
      if (pendingPasswordChange.current === pending)
        pendingPasswordChange.current = null;
    }
  };

  const signOut = async () => {
    // Logout needs the new cookie if a password change is rotating the session.
    await pendingPasswordChange.current?.catch(() => {});

    return run(async () => {
      await endSession();

      return null;
    }, "signout");
  };

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
        connectGoogle,
        createPassword,
        changePassword,
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
