import type { ReactNode } from "react";
import { Button, Brand, Icon, type IconName } from "@event-management/ui";

import { adminNav } from "./navigation";
import type { NavKey } from "../../app/navigation-types";

export function AdminSidebar({
  active,
  onNavigate,
  collapsed,
  onClose,
  accountMenu,
}: {
  active: NavKey;
  onNavigate: (key: NavKey) => void;
  collapsed: boolean;
  onClose: () => void;
  accountMenu: ReactNode;
}) {
  const iconFor: Record<NavKey, IconName> = {
    Overview: "grid",
    Bookings: "clipboard",
    Messages: "message",
    Customers: "users",
    Calendar: "calendar",
    Packages: "box",
    Services: "spark",
    Inventory: "box",
    Operations: "clipboard",
    Reports: "chart",
    Administration: "settings",
  };
  const labelFor: Partial<Record<NavKey, string>> = {
    Customers: "Customers",
  };
  return (
    <aside className={`sidebar ${collapsed ? "" : "sidebar-open"}`}>
      <div className="sidebar-top">
        <Brand light />
        <Button
          variant="plain"
          className="sidebar-close"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <Icon name="close" />
        </Button>
      </div>
      <div className="workspace-label">Workspace</div>
      <nav className="side-nav">
        {adminNav.map((item) => (
          <Button
            variant="plain"
            key={item}
            className={active === item ? "active" : ""}
            onClick={() => {
              onNavigate(item);
              onClose();
            }}
          >
            <Icon name={iconFor[item]} />
            <span>{labelFor[item] ?? item}</span>
            {item === "Operations" && <b>3</b>}
          </Button>
        ))}
      </nav>
      <div className="sidebar-user">{accountMenu}</div>
    </aside>
  );
}
