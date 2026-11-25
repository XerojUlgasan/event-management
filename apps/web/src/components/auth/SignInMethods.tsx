import { useEffect, useId, useRef, useState, type SubmitEvent } from "react";
import {
  Button,
  FormField,
  GoogleMark,
  Input,
  Panel,
  Select,
  useNotifications,
} from "@event-management/ui";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@event-management/contracts/limits/auth";
import { firebaseConfigured, useAuth } from "../../lib/auth/AuthProvider";

type Action = "change" | "add" | "connect" | null;

export function SignInMethods() {
  const { notify } = useNotifications();
  const { profile, connectGoogle, createPassword, changePassword, clearError } =
    useAuth();
  const [action, setAction] = useState<Action>(null);
  const [method, setMethod] = useState<"google" | "password">("google");
  const [currentPassword, setCurrentPassword] = useState("");
  const [firebaseEmail, setFirebaseEmail] = useState(profile?.email ?? "");
  const [firebasePassword, setFirebasePassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const passwordActionRef = useRef<HTMLButtonElement>(null);
  const connectActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (action)
      formRef.current
        ?.querySelector<HTMLInputElement>("input:not([type=checkbox])")
        ?.focus();
  }, [action]);

  if (!profile) return null;

  const closeForm = () => {
    setAction(null);
    setCurrentPassword("");
    setFirebasePassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMethod("google");
    setShowPasswords(false);
    setFormError("");
    clearError();
  };

  const openForm = (next: Action) => {
    if (action === next) {
      closeForm();

      return;
    }

    closeForm();
    setFirebaseEmail(profile.email);
    setAction(next);
  };

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    setFormError("");

    if (
      action !== "connect" &&
      (newPassword.length < MIN_PASSWORD_LENGTH ||
        newPassword.length > MAX_PASSWORD_LENGTH)
    ) {
      setFormError(
        `Use a password between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`,
      );

      return;
    }

    if (action !== "connect" && newPassword !== confirmPassword) {
      setFormError("Passwords do not match.");

      return;
    }

    setBusy(true);

    try {
      if (action === "connect") {
        await connectGoogle(currentPassword);
        notify("Google account connected. You can now sign in with Google.");
      } else if (action === "add") {
        await createPassword(
          newPassword,
          method,
          firebaseEmail.trim(),
          firebasePassword,
        );
        notify(
          "Password added. You can now sign in with your email and password.",
        );
      } else if (action === "change") {
        await changePassword(currentPassword, newPassword);
        notify("Password changed.");
      }

      closeForm();
    } catch {
      // AuthProvider reports API and Firebase errors without signing the user out.
    } finally {
      setBusy(false);
    }
  };

  const form = action && (
    <form
      ref={formRef}
      id={formId}
      className="account-security-form"
      onSubmit={submit}
    >
      <h3>
        {action === "change"
          ? "Change password"
          : action === "add"
            ? "Add a password"
            : "Connect Google"}
      </h3>
      <p>
        {action === "change"
          ? "Enter your current password and choose a new one."
          : action === "add"
            ? "Choose a password and verify your connected account. Its email must be verified and match your account email."
            : "Enter your current password, then choose the Google account you want to use. Existing separate accounts cannot be merged."}
      </p>
      <fieldset disabled={busy}>
        {(action === "change" || action === "connect") && (
          <FormField label="Current password">
            {(field) => (
              <Input
                {...field}
                type={showPasswords ? "text" : "password"}
                autoComplete="current-password"
                maxLength={MAX_PASSWORD_LENGTH}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            )}
          </FormField>
        )}
        {action !== "connect" && (
          <>
            <FormField
              label="New password"
              description={`Use ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters.`}
            >
              {(field) => (
                <Input
                  {...field}
                  type={showPasswords ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  maxLength={MAX_PASSWORD_LENGTH}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
              )}
            </FormField>
            <FormField label="Confirm new password">
              {(field) => (
                <Input
                  {...field}
                  type={showPasswords ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  maxLength={MAX_PASSWORD_LENGTH}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              )}
            </FormField>
          </>
        )}
        {action === "add" && (
          <>
            <FormField label="Connected sign-in method">
              {(field) => (
                <Select
                  {...field}
                  value={method}
                  onChange={(event) => {
                    setMethod(
                      event.target.value === "password" ? "password" : "google",
                    );
                    setFirebasePassword("");
                  }}
                >
                  <option value="google">Google</option>
                  <option value="password">Email and password</option>
                </Select>
              )}
            </FormField>
            {method === "password" && (
              <>
                <FormField label="Existing account email address">
                  {(field) => (
                    <Input
                      {...field}
                      type="email"
                      autoComplete="username"
                      value={firebaseEmail}
                      onChange={(event) => setFirebaseEmail(event.target.value)}
                      required
                    />
                  )}
                </FormField>
                <FormField label="Existing account password">
                  {(field) => (
                    <Input
                      {...field}
                      type={showPasswords ? "text" : "password"}
                      autoComplete="current-password"
                      value={firebasePassword}
                      onChange={(event) =>
                        setFirebasePassword(event.target.value)
                      }
                      required
                    />
                  )}
                </FormField>
              </>
            )}
          </>
        )}
        <label className="account-show-password">
          <Input
            variant="plain"
            type="checkbox"
            checked={showPasswords}
            onChange={(event) => setShowPasswords(event.target.checked)}
          />{" "}
          Show passwords
        </label>
        {formError && (
          <p className="account-form-error" role="alert">
            {formError}
          </p>
        )}
        <div className="account-form-actions">
          <Button type="submit" pending={busy}>
            {busy
              ? action === "connect"
                ? "Connecting…"
                : action === "add"
                  ? "Adding password…"
                  : "Changing password…"
              : action === "connect"
                ? "Connect with Google"
                : action === "add"
                  ? "Verify account and add password"
                  : "Save password"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const opener =
                action === "connect" ? connectActionRef : passwordActionRef;
              closeForm();
              opener.current?.focus();
            }}
          >
            Cancel
          </Button>
        </div>
      </fieldset>
    </form>
  );

  return (
    <Panel
      as="section"
      className="sign-in-methods"
      aria-labelledby="sign-in-methods-title"
    >
      <div className="account-security-heading">
        <h2 id="sign-in-methods-title">Sign-in methods</h2>
      </div>
      <div className="account-method">
        <div>
          <h3>Email and password</h3>
          <p>
            {profile.hasPassword ? "Password enabled" : "No password added"}
          </p>
        </div>
        {profile.hasPassword ? (
          <Button
            variant="secondary"
            size="small"
            ref={passwordActionRef}
            aria-expanded={action === "change"}
            aria-controls={action === "change" ? formId : undefined}
            onClick={() => openForm("change")}
            disabled={busy}
          >
            Change password
          </Button>
        ) : firebaseConfigured ? (
          <Button
            variant="secondary"
            size="small"
            ref={passwordActionRef}
            aria-expanded={action === "add"}
            aria-controls={action === "add" ? formId : undefined}
            onClick={() => openForm("add")}
            disabled={busy}
          >
            Add password
          </Button>
        ) : (
          <span className="account-method-unavailable">
            Currently unavailable
          </span>
        )}
      </div>
      {(action === "change" || action === "add") && form}
      <div className="account-method">
        <div>
          <h3>Connected sign-in</h3>
          <p>{profile.firebaseUid ? "Connected" : "Not connected"}</p>
        </div>
        {!profile.firebaseUid &&
          profile.hasPassword &&
          (firebaseConfigured ? (
            <Button
              variant="secondary"
              size="small"
              ref={connectActionRef}
              aria-expanded={action === "connect"}
              aria-controls={action === "connect" ? formId : undefined}
              onClick={() => openForm("connect")}
              disabled={busy}
            >
              <GoogleMark className="account-google-mark" />
              Connect Google
            </Button>
          ) : (
            <span className="account-method-unavailable">
              Currently unavailable
            </span>
          ))}
      </div>
      {action === "connect" && form}
    </Panel>
  );
}
