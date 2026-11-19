import type { Meta, StoryObj } from "@storybook/react-vite";

import { Brand, WorkspaceLayout } from "@event-management/ui";

const meta = {
  title: "Templates/WorkspaceLayout",
  component: WorkspaceLayout,
  parameters: { layout: "fullscreen" },
  args: {
    sidebar: (
      <aside className="sidebar" style={{ position: "static" }}>
        <Brand light />
      </aside>
    ),
    header: <header className="app-header">Workspace header</header>,
    children: (
      <div className="content-stack">
        <div className="page-title">Overview</div>
        <p style={{ color: "var(--muted)" }}>Page content renders here.</p>
      </div>
    ),
  },
} satisfies Meta<typeof WorkspaceLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
