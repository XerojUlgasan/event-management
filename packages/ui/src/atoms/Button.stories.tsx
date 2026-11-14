import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@event-management/ui";

const meta = {
  title: "Atoms/Button",
  component: Button,
  args: { children: "Plan your event" },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "primary",
        "secondary",
        "ghost",
        "light",
        "plain",
        "link",
        "danger",
      ],
    },
    icon: {
      control: "select",
      options: [undefined, "arrow", "check", "spark"],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: "secondary" } };
export const Link: Story = {
  args: { variant: "link", children: "View details" },
};
export const WithIcon: Story = {
  args: { icon: "arrow", children: "Start planning" },
};
export const Small: Story = {
  args: { variant: "secondary", size: "small", children: "Edit" },
};
export const IconOnly: Story = {
  args: {
    variant: "secondary",
    size: "icon",
    icon: "close",
    children: null,
    "aria-label": "Close",
  },
};
export const PlainComposite: Story = {
  args: { variant: "plain", children: "Custom navigation" },
};
export const Disabled: Story = {
  args: { disabled: true, children: "Saving…" },
};
export const Pending: Story = { args: { pending: true, children: "Saving…" } };
export const Danger: Story = {
  args: { variant: "danger", children: "Delete venue" },
};
export const Toggle: Story = {
  args: { variant: "secondary", "aria-pressed": true, children: "Available" },
};
export const OnDark: Story = {
  render: () => (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: 24,
        background: "var(--wine)",
        borderRadius: 12,
      }}
    >
      <Button variant="ghost">Explore packages</Button>
      <Button variant="light">Start planning</Button>
    </div>
  ),
};
