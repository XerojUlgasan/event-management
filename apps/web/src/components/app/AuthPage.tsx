import { MAX_DISPLAY_NAME_LENGTH, MAX_EMAIL_LENGTH, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@event-management/contracts/limits/auth"
import { useState } from "react";
import type { SubmitEvent } from "react";
import { Brand, Button, FormField, Icon } from "@event-management/ui";

import { firebaseConfigured, useAuth } from "../../lib/auth";

export function AuthPage({ onBack }: { onBack: () => void }) {
  const {
    signIn,
    signUp,
    signInWithGoogle,
    signInWithFirebase,
    error,
    clearError,
  } = useAuth();
  const [useFirebase, setUseFirebase] = useState(false);
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const message = formError || error;

  const changeMode = (next: "signin" | "register") => {
    setMode(next);
    setUseFirebase(false);
    setFormError("");
    setConfirmPassword("");
    clearError();
  };

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    clearError();

    if (mode === "register") {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setFormError(`Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }
      if (password !== confirmPassword) {
        setFormError("Passwords do not match.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "register") {
        await signUp(name.trim(), email.trim(), password);
      } else {
        await (useFirebase ? signInWithFirebase : signIn)(
          email.trim(),
          password,
        );
      }
    } catch {
      // The auth provider exposes the friendly error message.
    } finally {
      setSubmitting(false);
    }
  };

  const continueWithGoogle = async () => {
    setFormError("");
    clearError();
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch {
      // The auth provider exposes the friendly error message.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-visual">
        <div className="login-photo"></div>
        <div className="login-photo-overlay"></div>
        <button className="login-back" onClick={onBack}>
          <Icon name="arrow" size={16} /> Back to customer site
        </button>
        <div className="login-visual-content">
          <Brand light />
          <div className="login-quote">
            One connected workspace, from first inquiry to final service.
          </div>
          <p>
            Sign in to manage bookings, quotations, and event details in one
            place. New customers can create an account with email or Google.
          </p>
          <div className="login-security-note">
            <Icon name="check" />
            Your account, with secure sign-in options
          </div>
        </div>
      </div>

      <main className="login-main">
        <div className="login-form-wrap">
          <div className="auth-mode-tabs">
            <button
              className={mode === "signin" ? "active" : ""}
              disabled={submitting}
              onClick={() => changeMode("signin")}
              type="button"
            >
              Sign in
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              disabled={submitting}
              onClick={() => changeMode("register")}
              type="button"
            >
              Create account
            </button>
          </div>
          <span className="eyebrow">Clemora account</span>
          <div className="login-title">
            {mode === "register" ? "Create your account" : "Welcome back"}
          </div>
          <p className="login-intro">
            {mode === "register"
              ? "Create a customer account to request packages and track your events."
              : "Sign in to manage your events, quotations, and messages."}
          </p>

          <form className="login-form" onSubmit={submit}>
            {mode === "register" && (
              <FormField label="Full name">
                <div className="login-input">
                  <Icon name="users" size={16} />
                  <input
                    autoComplete="name"
                    maxLength={MAX_DISPLAY_NAME_LENGTH}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setFormError("");
                      clearError();
                    }}
                    placeholder="Your name"
                    required
                  />
                </div>
              </FormField>
            )}
            <FormField label="Email address">
              <div className="login-input">
                <Icon name="users" size={16} />
                <input
                  type="email"
                  autoComplete="email"
                  maxLength={MAX_EMAIL_LENGTH}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setFormError("");
                    clearError();
                  }}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </FormField>
            <FormField label="Password">
              <div className="login-input">
                <Icon name="settings" size={16} />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setFormError("");
                    clearError();
                  }}
                  minLength={mode === "register" ? MIN_PASSWORD_LENGTH : undefined}
                  maxLength={mode === "signin" && useFirebase ? 4096 : MAX_PASSWORD_LENGTH}
                  placeholder={
                    mode === "register"
                      ? `At least ${MIN_PASSWORD_LENGTH} characters`
                      : "Your password"
                  }
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </FormField>
            {mode === "register" && (
              <FormField label="Confirm password">
                <div className="login-input">
                  <Icon name="settings" size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    maxLength={MAX_PASSWORD_LENGTH}
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setFormError("");
                      clearError();
                    }}
                    placeholder="Repeat your password"
                    required
                  />
                </div>
              </FormField>
            )}

            {mode === "signin" && firebaseConfigured && (
              <label className="auth-existing-account">
                <input
                  type="checkbox"
                  checked={useFirebase}
                  disabled={submitting}
                  onChange={(event) => {
                    setUseFirebase(event.target.checked);
                    clearError();
                  }}
                />
                Use my existing Firebase email account
              </label>
            )}

            {message && (
              <div className="login-error" role="alert">
                <Icon name="alert" size={16} />
                <span>{message}</span>
              </div>
            )}

            <Button
              type="submit"
              className="login-submit"
              disabled={submitting}
            >
              {submitting
                ? mode === "register"
                  ? "Creating account…"
                  : "Signing in…"
                : mode === "register"
                  ? "Create account"
                  : "Sign in"}
            </Button>
          </form>

          {firebaseConfigured && (
            <>
              <div className="auth-divider">
                <span>or continue with</span>
              </div>

              <button
                type="button"
                className="google-button"
                onClick={continueWithGoogle}
                disabled={submitting}
              >
                <svg
                  className="google-icon"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
                  />
                  <path
                    fill="#EA4335"
                    d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
                  />
                </svg>
                Continue with Google
              </button>
            </>
          )}

          <p className="login-disclaimer">
            Customer sign-up is open. Team accounts are created by an
            administrator.
          </p>
        </div>
      </main>
    </div>
  );
}
