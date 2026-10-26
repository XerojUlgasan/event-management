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
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import type { User } from "firebase/auth";

import { endSession, getMe, syncSession } from "./api";
import type { Profile } from "./api";
import { firebaseAuth, googleProvider } from "./firebase";

type Status = "loading" | "signed-out" | "signed-in";

type AuthContextValue = {
  status: Status;
  profile: Profile | null;
  error: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function messageFor(error: unknown) {
  const code = (error as { code?: string }).code;

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "That email is already registered. Sign in instead.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "Use a password with at least 6 characters.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Google sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in popup. Allow popups and try again.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return error instanceof Error ? error.message : "Something went wrong. Try again.";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const pending = useRef(false);

  const establishSession = useCallback(
    async (user: User, options: { fresh?: boolean; displayName?: string } = {}) => {
      if (!options.fresh) {
        try {
          const existing = await getMe();
          if (existing.firebaseUid === user.uid) {
            setProfile(existing);
            setStatus("signed-in");
            return;
          }
        } catch {
          // No usable session cookie; create one from the Firebase identity.
        }
      }

      const token = await user.getIdToken();
      const nextProfile = await syncSession(
        token,
        options.displayName ?? user.displayName ?? undefined,
      );
      setProfile(nextProfile);
      setStatus("signed-in");
    },
    [],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (pending.current) return;

      if (!user) {
        setProfile(null);
        setStatus("signed-out");
        return;
      }

      setStatus("loading");
      void establishSession(user).catch((cause) => {
        setError(messageFor(cause));
        setProfile(null);
        setStatus("signed-out");
      });
    });

    return unsubscribe;
  }, [establishSession]);

  const run = useCallback(async (task: () => Promise<void>) => {
    setError("");
    pending.current = true;

    try {
      await task();
    } catch (cause) {
      setError(messageFor(cause));
      setProfile(null);
      setStatus("signed-out");
      try {
        await endSession();
      } catch {
        // Ignore; the Firebase session is still cleared below.
      }
      if (firebaseAuth.currentUser) {
        await firebaseSignOut(firebaseAuth);
      }
      throw cause;
    } finally {
      pending.current = false;
    }
  }, []);

  const signIn = useCallback(
    (email: string, password: string) =>
      run(async () => {
        const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        await establishSession(credential.user, { fresh: true });
      }),
    [establishSession, run],
  );

  const signUp = useCallback(
    (name: string, email: string, password: string) =>
      run(async () => {
        const credential = await createUserWithEmailAndPassword(
          firebaseAuth,
          email,
          password,
        );
        await updateProfile(credential.user, { displayName: name });
        await establishSession(credential.user, { fresh: true, displayName: name });
      }),
    [establishSession, run],
  );

  const signInWithGoogle = useCallback(
    () =>
      run(async () => {
        const credential = await signInWithPopup(firebaseAuth, googleProvider);
        await establishSession(credential.user, { fresh: true });
      }),
    [establishSession, run],
  );

  const signOut = useCallback(async () => {
    setError("");
    try {
      await endSession();
    } catch {
      // Even if the API is unreachable, clear the Firebase session locally.
    }
    await firebaseSignOut(firebaseAuth);
    setProfile(null);
    setStatus("signed-out");
  }, []);

  const clearError = useCallback(() => setError(""), []);

  return (
    <AuthContext.Provider
      value={{ status, profile, error, signIn, signUp, signInWithGoogle, signOut, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
