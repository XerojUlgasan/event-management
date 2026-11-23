import { navigateWorkspace } from "../../../lib/navigation/workspace-navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Avatar,
  Icon,
  Panel,
  WorkspaceLayout,
} from "@event-management/ui";

import type { NavKey } from "../../app/navigation-types";
import type { AdminAiSection } from "../../app/routes";
import {
  firstName,
  initialsFromName,
} from "../../../lib/utils/formatting/name";
import { AiPage } from "./ai/AiPage";
import { BookingsPage } from "./booking-requests/BookingsPage";
import { CalendarPage } from "./calendar/CalendarPage";
import { GenericPage } from "./navigation/GenericPage";
import { InventoryPage } from "./inventory/InventoryPage";
import { MessagesPage } from "./messages/MessagesPage";
import { OperationsPage } from "./operations/OperationsPage";
import { OverviewPage } from "./overview/OverviewPage";
import { PackagesPage } from "./catalog/PackagesPage";
import { ServicesPage } from "./catalog/ServicesPage";
import { ShowcasesPage } from "./showcases/ShowcasesPage";
import { ReportsPage } from "./reports/ReportsPage";
import { CustomersPage } from "./users/CustomersPage";
import { BusinessInformationPage } from "./business-information/BusinessInformationPage";
import { AdminSidebar } from "./AdminSidebar";
import { SignInMethods } from "../../auth/SignInMethods";
import { NotificationBell } from "../../notifications/NotificationBell";
import { adminPaths } from "../../app/routes";

function AccountMenu({
  name,
  sidebar = false,
  onSettings,
  onSignOut,
}: {
  name: string;
  sidebar?: boolean;
  onSettings: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };

    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };

    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);

    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div
      className={`account-menu-wrap ${sidebar ? "account-menu-sidebar" : ""}`}
      ref={container}
    >
      <Button
        variant="plain"
        type="button"
        ref={trigger}
        className="account-menu-trigger"
        aria-label={`Account menu for ${name}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Avatar initials={initialsFromName(name)} />
        {sidebar && <span>{name}</span>}
      </Button>
      {open && (
        <div className="account-menu">
          <Button
            variant="plain"
            type="button"
            onClick={() => {
              setOpen(false);
              onSettings();
            }}
          >
            Account settings
          </Button>
          <Button
            variant="plain"
            type="button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            Sign out
          </Button>
        </div>
      )}
    </div>
  );
}

export function AdminShell({
  profile,
  onSignOut,
  active,
  aiSection = "knowledge",
  bookingRequestId,
  search,
}: {
  profile: { id: string; displayName: string | null; email: string };
  onSignOut: () => void;
  active: NavKey;
  aiSection?: AdminAiSection;
  bookingRequestId?: string;
  search: string;
}) {
  const name = profile.displayName ?? profile.email;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [businessInformationVisited, setBusinessInformationVisited] = useState(
    active === "BusinessInformation",
  );

  useEffect(() => {
    if (active === "BusinessInformation") setBusinessInformationVisited(true);
  }, [active]);

  const go = (key: NavKey) => {
    navigateWorkspace(adminPaths[key]);
  };

  const body = useMemo(() => {
    if (active === "AI") return <AiPage section={aiSection} />;

    if (active === "Overview")
      return <OverviewPage firstName={firstName(name)} onNavigate={go} />;

    if (active === "Bookings")
      return <BookingsPage bookingRequestId={bookingRequestId} />;

    if (active === "Messages")
      return (
        <MessagesPage
          requestedConversation={new URLSearchParams(search).get(
            "conversation",
          )}
        />
      );

    if (active === "Customers") return <CustomersPage />;

    if (active === "Calendar") return <CalendarPage />;

    if (active === "Packages") return <PackagesPage />;

    if (active === "Services") return <ServicesPage />;

    if (active === "Showcases") return <ShowcasesPage />;

    if (active === "BusinessInformation") return null;

    if (active === "Inventory") return <InventoryPage />;

    if (active === "Operations") return <OperationsPage />;

    if (active === "Reports") return <ReportsPage />;

    if (active === "Administration")
      return (
        <section className="account-settings">
          <h1 className="page-title">Account settings</h1>
          <Panel className="account-summary">
            <h2>Profile</h2>
            <dl>
              <div>
                <dt>Name</dt>
                <dd>{name}</dd>
              </div>
              <div>
                <dt>Email address</dt>
                <dd>{profile.email}</dd>
              </div>
            </dl>
          </Panel>
          <SignInMethods />
        </section>
      );

    return <GenericPage page={active} />;
  }, [active, aiSection, name, profile.email, bookingRequestId, search]);

  return (
    <WorkspaceLayout
      sidebar={
        <>
          <AdminSidebar
            active={active}
            onNavigate={go}
            collapsed={!sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            accountMenu={
              <AccountMenu
                name={name}
                sidebar
                onSettings={() => {
                  go("Administration");
                  setSidebarOpen(false);
                }}
                onSignOut={onSignOut}
              />
            }
          />
          {sidebarOpen && (
            <Button
              variant="plain"
              className="sidebar-scrim"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            ></Button>
          )}
        </>
      }
      header={
        <header className="app-header">
          <Button
            variant="plain"
            className="icon-button app-menu"
            aria-label="Open sidebar"
            onClick={() => setSidebarOpen(true)}
          >
            <Icon name="menu" />
          </Button>
          <div className="app-header-actions">
            <NotificationBell key={profile.id} profileId={profile.id} />
            <AccountMenu
              name={name}
              onSettings={() => go("Administration")}
              onSignOut={onSignOut}
            />
          </div>
        </header>
      }
    >
      {active !== "AI" &&
        active !== "Bookings" &&
        active !== "Packages" &&
        active !== "Services" &&
        active !== "Showcases" &&
        active !== "BusinessInformation" &&
        active !== "Administration" &&
        active !== "Messages" && (
          <p className="demo-note" role="note">
            Demo preview · Changes on this screen are not submitted.
          </p>
        )}
      {body}
      <div hidden={active !== "BusinessInformation"}>
        {businessInformationVisited && <BusinessInformationPage />}
      </div>
    </WorkspaceLayout>
  );
}
