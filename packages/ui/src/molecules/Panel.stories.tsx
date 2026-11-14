import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge, Button, Panel } from "@event-management/ui";

const meta = {
  title: "Molecules/Panel",
  component: Panel,
  args: {
    title: "Today’s assignments",
    description: "Monday, June 16",
    children: <p style={{ margin: 0, color: "var(--muted)" }}>Panel content</p>,
  },
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const SemanticSection: Story = {
  args: { as: "section", "aria-label": "Assignments" },
};
export const WithAction: Story = {
  args: { action: <Button variant="secondary">View all</Button> },
};
export const WithBadgeAction: Story = {
  args: {
    title: "Needs attention",
    description: "Items requiring a decision",
    action: <Badge tone="danger">3 urgent</Badge>,
  },
};
export const BodyOnly: Story = {
  args: { title: undefined, description: undefined },
};
