import { GoogleMark, InputGroup, Tabs } from "@event-management/ui"
import { Input } from "@event-management/ui"
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
        <Button variant="ghost" className="login-back" onClick={onBack}>
          <Icon name="arrow" size={16} /> Back to customer site
        </Button>
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
          <Tabs
            className="auth-mode-tabs"
            variant="segmented"
            role="group"
            aria-label="Account access"
            active={mode}
            items={[{ value: "signin", label: "Sign in", disabled: submitting }, { value: "register", label: "Create account", disabled: submitting }]}
            onChange={value => { if (value === "signin" || value === "register") changeMode(value) }}
          />
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
                <InputGroup>
                  <Icon name="users" size={16} />
                  <Input variant="plain"
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
                </InputGroup>
              </FormField>
            )}
            <FormField label="Email address">
              <InputGroup>
                <Icon name="users" size={16} />
                <Input variant="plain"
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
              </InputGroup>
            </FormField>
            <FormField label="Password">
              <InputGroup>
                <Icon name="settings" size={16} />
                <Input variant="plain"
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
                <Button size="small" variant="light"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </Button>
              </InputGroup>
            </FormField>
            {mode === "register" && (
              <FormField label="Confirm password">
                <InputGroup>
                  <Icon name="settings" size={16} />
                  <Input variant="plain"
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
                </InputGroup>
              </FormField>
            )}

            {mode === "signin" && firebaseConfigured && (
              <label className="auth-existing-account">
                <Input variant="plain"
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

            <Button variant="primary"
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

              <Button variant="secondary"
                type="button"
                className="google-button"
                onClick={continueWithGoogle}
                disabled={submitting}
              >
                <GoogleMark className="google-icon" />
                Continue with Google
              </Button>
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
