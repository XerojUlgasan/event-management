import type { ReactNode } from "react";

export function WorkspaceLayout({
  sidebar,
  header,
  children,
}: {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      {sidebar}
      <div className="app-area">
        {header}
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
