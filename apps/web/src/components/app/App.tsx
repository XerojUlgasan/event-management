import { useEffect, useRef, useState } from "react";
import { Brand, Button, NotificationProvider } from "@event-management/ui";

import { claimGuestChat } from "../../lib/data/messages/guest";
import { AuthProvider, useAuth } from "../../lib/auth/AuthProvider";
import {
  interceptWorkspaceLink,
  navigateWorkspace,
  useWorkspaceLocation,
} from "../../lib/navigation/workspace-navigation";
import { AdminShell } from "../workspaces/admin/AdminShell";
import { AuthPage } from "../auth/AuthPage";
import { CustomerDashboard } from "../workspaces/customer/CustomerDashboard";
import { CatalogNavigationProvider } from "../catalog/CatalogNavigationProvider";
import {
  adminBookingRequestId,
  adminKey,
  allowedWorkspacePath,
  appHome,
  isSystemAdmin,
  normalizePath,
  workspaceReturnPath,
} from "./routes";

export default function App({
  initialPath,
  initialSearch,
}: {
  initialPath: string;
  initialSearch: string;
}) {
  const location = useWorkspaceLocation(`${initialPath}${initialSearch}`);
  const previousPath = useRef(location.path);
  useEffect(() => {
    document.addEventListener("click", interceptWorkspaceLink);
    return () => document.removeEventListener("click", interceptWorkspaceLink);
  }, []);
  useEffect(() => {
    if (previousPath.current === location.path) return;
    previousPath.current = location.path;
    if (location.hash) {
      try {
        document
          .getElementById(decodeURIComponent(location.hash.slice(1)))
          ?.scrollIntoView();
      } catch {
        /* Invalid fragments retain their URL. */
      }
      return;
    }
    window.scrollTo(0, 0);
    const heading =
      document.querySelector<HTMLElement>("main h1, main [role='heading']") ??
      document.querySelector<HTMLElement>("main");
    if (heading) {
      const previous = heading.getAttribute("tabindex");
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
      if (previous === null) heading.removeAttribute("tabindex");
      else heading.setAttribute("tabindex", previous);
    }
  }, [location.path, location.hash]);
  return (
    <NotificationProvider>
      <AuthProvider>
        <Workspace
          path={normalizePath(location.path)}
          search={location.search}
          hash={location.hash}
        />
      </AuthProvider>
    </NotificationProvider>
  );
}

function Workspace({
  path,
  search,
  hash,
}: {
  path: string;
  search: string;
  hash: string;
}) {
  const { status, profile, signOut } = useAuth();
  const guestId =
    path === "/login" ? new URLSearchParams(search).get("guest") : null;
  const [claimAttempt, setClaimAttempt] = useState(0);
  const [claimError, setClaimError] = useState("");
  const mode =
    new URLSearchParams(search).get("mode") === "register"
      ? "register"
      : "signin";

  useEffect(() => {
    if (status !== "signed-in" || !profile) return;
    if (path === "/login" && guestId) {
      if (profile.role !== "customer") {
        setClaimError(
          "This conversation can only be continued with a customer account. You are signed in as an administrator.",
        );
        return;
      }
      let active = true;
      setClaimError("");
      void claimGuestChat(guestId)
        .then(({ conversationId }) => {
          if (active)
            window.location.replace(
              `/app/messages?conversation=${encodeURIComponent(conversationId)}${new URLSearchParams(search).get("createRequest") === "1" ? "&createRequest=1" : ""}`,
            );
        })
        .catch(() => {
          if (active)
            setClaimError(
              "You are signed in, but we could not attach this conversation. Retry, or continue to your workspace.",
            );
        });
      return () => {
        active = false;
      };
    }
    const home = appHome(profile);
    const params = new URLSearchParams(search);
    const book = params.get("book");
    const resume = params.get("booking") === "resume";
    if (path === "/login") {
      if (profile.role === "customer" && (book || resume)) {
        const next = new URLSearchParams();
        if (book) next.set("book", book);
        if (resume) next.set("booking", "resume");
        window.location.replace(`/app/home?${next}`);
      } else
        window.location.replace(
          workspaceReturnPath(profile, params.get("next")) ?? home,
        );
      return;
    }
    if (path === "/app") navigateWorkspace(`${home}${search}${hash}`, true);
    else if (!allowedWorkspacePath(profile, path))
      navigateWorkspace(home, true);
  }, [status, profile, path, search, hash, guestId, claimAttempt]);

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.assign("/login");
    } catch {
      // Keep the current account visible until the API confirms logout.
    }
  };

  if (status === "loading") {
    return (
      <div className="auth-splash">
        <Brand />
        <span>Loading your workspace…</span>
      </div>
    );
  }

  if (status !== "signed-in" || !profile) {
    if (path !== "/login") {
      const next = `${path}${search}${hash}`;
      window.location.replace(`/login?next=${encodeURIComponent(next)}`);
      return (
        <div className="auth-splash">
          <Brand />
          <span>Loading your workspace…</span>
        </div>
      );
    }
    return (
      <AuthPage
        initialMode={mode}
        onBack={() => {
          window.location.assign("/");
        }}
      />
    );
  }

  if (path === "/login" && guestId) {
    return (
      <main className="auth-splash">
        <Brand />
        <span>{claimError || "Continuing your conversation…"}</span>
        {claimError && (
          <>
            <Button onClick={() => setClaimAttempt((value) => value + 1)}>
              Retry
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.location.assign(appHome(profile))}
            >
              Continue to workspace
            </Button>
            <Button
              variant="link"
              onClick={() => {
                void signOut()
                  .then(() =>
                    window.location.assign(
                      `/login?guest=${encodeURIComponent(guestId)}${new URLSearchParams(search).get("createRequest") === "1" ? "&createRequest=1" : ""}`,
                    ),
                  )
                  .catch(() => {});
              }}
            >
              Sign in with another account
            </Button>
          </>
        )}
      </main>
    );
  }

  if (
    path === "/login" ||
    path === "/app" ||
    !allowedWorkspacePath(profile, path)
  ) {
    return (
      <div className="auth-splash">
        <Brand />
        <span>Loading your workspace…</span>
      </div>
    );
  }

  if (isSystemAdmin(profile)) {
    const active = adminKey(path);
    return active ? (
      <CatalogNavigationProvider
        key={`${profile.id}:${profile.role}`}
        route={`${path}${search}`}
      >
        <AdminShell
          profile={profile}
          active={active}
          bookingRequestId={adminBookingRequestId(path) ?? undefined}
          onSignOut={handleSignOut}
        />
      </CatalogNavigationProvider>
    ) : null;
  }
  return (
    <CatalogNavigationProvider
      key={`${profile.id}:${profile.role}`}
      route={`${path}${search}`}
    >
      <CustomerDashboard
        path={path}
        search={search}
        onPublic={() => {
          window.location.assign("/");
        }}
        userName={profile.displayName ?? profile.email}
        userEmail={profile.email}
        onSignOut={handleSignOut}
      />
    </CatalogNavigationProvider>
  );
}
