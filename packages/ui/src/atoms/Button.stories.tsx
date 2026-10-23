import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";

const meta = {
  title: "Atoms/Button",
  component: Button,
  args: { children: "Plan your event" },
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "ghost", "light"] },
    icon: { control: "select", options: [undefined, "arrow", "check", "spark"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: "secondary" } };
export const WithIcon: Story = { args: { icon: "arrow", children: "Start planning" } };
export const OnDark: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12, padding: 24, background: "var(--wine)", borderRadius: 12 }}>
      <Button variant="ghost">Explore packages</Button>
      <Button variant="light">Start planning</Button>
    </div>
  ),
};
