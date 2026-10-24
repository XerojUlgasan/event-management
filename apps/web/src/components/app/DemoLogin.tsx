import { useState } from "react"
import type { SubmitEvent } from "react"
import { Brand, Button, FormField, Icon } from "@event-management/ui"

import { demoAccounts } from "./data"
import type { Role } from "./types"

export function DemoLogin({
  onBack,
  onLogin,
}: {
  onBack: () => void
  onLogin: (role: "Customer" | Role) => void
}) {
  const [mode, setMode] = useState<"signin" | "register">("signin")
  const [selected, setSelected] = useState<(typeof demoAccounts)[number]>(
    demoAccounts[0],
  )
  const [name, setName] = useState("")
  const [email, setEmail] = useState<string>(demoAccounts[0].email)
  const [password, setPassword] = useState<string>(demoAccounts[0].password)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const selectAccount = (account: (typeof demoAccounts)[number]) => {
    setSelected(account)
    setEmail(account.email)
    setPassword(account.password)
    setError("")
  }

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (mode === "register") {
      onLogin("Customer")
      return
    }
    const account = demoAccounts.find(
      (item) => item.email === email && item.password === password,
    )
    if (!account) {
      setError(
        "These credentials do not match a demo account. Choose an account below to autofill its details.",
      )
      return
    }
    onLogin(account.role)
  }

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
            Explore Clemora through realistic role-based demo accounts. All
            records are mock data and remain inside this frontend prototype.
          </p>
          <div className="login-security-note">
            <Icon name="check" />
            Frontend demonstration · No real customer or business data
          </div>
        </div>
      </div>

      <main className="login-main">
        <div className="login-form-wrap">
          <div className="auth-mode-tabs">
            <button
              className={mode === "signin" ? "active" : ""}
              onClick={() => {
                setMode("signin")
                selectAccount(demoAccounts[0])
              }}
            >
              Sign in
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register")
                selectAccount(demoAccounts[0])
                setEmail("")
                setPassword("")
              }}
            >
              Create account
            </button>
          </div>
          <span className="eyebrow">Clemora demonstration</span>
          <div className="login-title">
            {mode === "register"
              ? "Create your account"
              : "Welcome back"}
          </div>
          <p className="login-intro">
            {mode === "register"
              ? "Create a mock customer account to explore packages and manage event requests."
              : "Use the prefilled demo credentials to access this frontend prototype."}
          </p>

          <form className="login-form" onSubmit={submit}>
            {mode === "register" && (
              <FormField label="Full name">
                <div className="login-input">
                  <Icon name="users" size={16} />
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
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
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setError("")
                  }}
                  required
                />
              </div>
            </FormField>
            <FormField label="Password">
              <div className="login-input">
                <Icon name="settings" size={16} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setError("")
                  }}
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
            {mode !== "register" && (
              <div className="login-options">
                <label>
                  <input type="checkbox" defaultChecked />
                  <span>Keep me signed in for this demo</span>
                </label>
                <button type="button">Forgot password?</button>
              </div>
            )}
            {error && (
              <div className="login-error">
                <Icon name="alert" size={16} />
                <span>{error}</span>
              </div>
            )}
            <Button type="submit" className="login-submit">
              {mode === "register"
                ? "Create demo account"
                : `Sign in as ${selected.role}`}
            </Button>
          </form>

            {mode !== "register" && (
              <>
              <div className="demo-divider">
                <span>Choose a role-based demo account</span>
              </div>

              <div className="demo-account-grid">
                {demoAccounts.map((account) => (
                    <button
                      className={
                        selected.role === account.role ? "active" : ""
                      }
                      onClick={() => selectAccount(account)}
                      key={account.role}
                    >
                      <span
                        className={`demo-avatar demo-${account.role.toLowerCase()}`}
                      >
                        {account.initials}
                      </span>
                      <span>
                        <strong>{account.role}</strong>
                        <small>{account.name}</small>
                      </span>
                      {selected.role === account.role && (
                        <i><Icon name="check" size={12} /></i>
                      )}
                    </button>
                  ))}
              </div>

              <div className="selected-demo-account">
                <div>
                  <span
                    className={`demo-avatar demo-${selected.role.toLowerCase()}`}
                  >
                    {selected.initials}
                  </span>
                  <span>
                    <strong>{selected.name}</strong>
                    <small>{selected.description}</small>
                  </span>
                </div>
                <dl>
                  <div><dt>Email</dt><dd>{selected.email}</dd></div>
                  <div><dt>Password</dt><dd>{selected.password}</dd></div>
                </dl>
                <Button
                  variant="secondary"
                  onClick={() => onLogin(selected.role)}
                  icon="arrow"
                >
                  Enter {selected.role} demo
                </Button>
              </div>
            </>
          )}

          <p className="login-disclaimer">
            Demo accounts use mock data and simulated interactions. No backend,
            external authentication, or persistent storage is connected.
          </p>
        </div>
      </main>
    </div>
  )
}
