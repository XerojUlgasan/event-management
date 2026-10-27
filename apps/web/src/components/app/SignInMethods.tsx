import { useState } from "react";
import type { SubmitEvent } from "react";
import { Button, FormField, Panel } from "@event-management/ui";
import { firebaseConfigured, useAuth } from "../../lib/auth";

export function SignInMethods() {
  const { profile, connectFirebase, createPassword, clearError } = useAuth();
  const [method, setMethod] = useState<"google" | "password">("google");
  const [currentPassword, setCurrentPassword] = useState("");
  const [firebaseEmail, setFirebaseEmail] = useState(profile?.email ?? "");
  const [firebasePassword, setFirebasePassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  if (!profile) return null;

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    setMessage("");
    setFormError("");
    if (!profile.hasPassword && newPassword !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (profile.hasPassword) {
        await connectFirebase(
          currentPassword,
          method,
          firebaseEmail.trim(),
          firebasePassword,
        );
        setMessage("Firebase connected. Both methods now open this account.");
      } else {
        await createPassword(
          newPassword,
          method,
          firebaseEmail.trim(),
          firebasePassword,
        );
        setMessage(
          "Password added. You can now sign in with your email and password.",
        );
      }
      setCurrentPassword("");
      setFirebasePassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      // AuthProvider displays API and Firebase errors without signing the user out.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="sign-in-methods">
      <h2>Sign-in methods</h2>
      <p>
        Account email: <strong>{profile.email}</strong>
      </p>
      <ul>
        <li>
          Email and password: {profile.hasPassword ? "Enabled" : "Not added"}
        </li>
        <li>
          Firebase (Google or existing email account):{" "}
          {profile.firebaseUid ? "Connected" : "Not connected"}
        </li>
      </ul>
      {message && <p role="status">{message}</p>}
      {(!profile.hasPassword || !profile.firebaseUid) &&
        (firebaseConfigured ? (
          <form onSubmit={submit}>
            <p>
              {profile.hasPassword
                ? "Enter your account password, then sign in to the Firebase account you want to connect. Existing separate accounts cannot be merged."
                : "Choose a new password and sign in again with your connected Firebase account. Its email must be verified and match your account email."}
            </p>
            <fieldset disabled={busy}>
              {profile.hasPassword ? (
                <FormField label="Current account password">
                  <input
                    type="password"
                    autoComplete="current-password"
                    maxLength={128}
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                  />
                </FormField>
              ) : (
                <>
                  <FormField label="New account password">
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={15}
                      maxLength={128}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="At least 15 characters"
                      required
                    />
                  </FormField>
                  <FormField label="Confirm new password">
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={15}
                      maxLength={128}
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      required
                    />
                  </FormField>
                </>
              )}
              <FormField label="Firebase sign-in method">
                <select
                  value={method}
                  onChange={(event) =>
                    setMethod(event.target.value as "google" | "password")
                  }
                >
                  <option value="google">Google</option>
                  <option value="password">
                    Existing Firebase email and password
                  </option>
                </select>
              </FormField>
              {method === "password" && (
                <>
                  <FormField label="Firebase email address">
                    <input
                      type="email"
                      autoComplete="username"
                      value={firebaseEmail}
                      onChange={(event) => setFirebaseEmail(event.target.value)}
                      required
                    />
                  </FormField>
                  <FormField label="Firebase password">
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={firebasePassword}
                      onChange={(event) =>
                        setFirebasePassword(event.target.value)
                      }
                      required
                    />
                  </FormField>
                </>
              )}
              {formError && <p role="alert">{formError}</p>}
              <Button type="submit" disabled={busy}>
                {busy
                  ? "Connecting…"
                  : profile.hasPassword
                    ? "Connect Firebase account"
                    : "Verify Firebase and add password"}
              </Button>
            </fieldset>
          </form>
        ) : (
          <p>Connecting Firebase sign-in is currently unavailable.</p>
        ))}
    </Panel>
  );
}
