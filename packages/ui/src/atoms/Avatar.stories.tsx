import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "./Avatar";

const meta = {
  title: "Atoms/Avatar",
  component: Avatar,
  args: { initials: "MA" },
  argTypes: { size: { control: "select", options: ["sm", "md", "lg"] } },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Small: Story = { args: { size: "sm", initials: "AS" } };
export const Large: Story = { args: { size: "lg", initials: "JB" } };
export const Group: Story = {
  render: () => (
    <div style={{ display: "flex" }}>
      <Avatar size="sm" initials="AS" />
      <Avatar size="sm" className="second" initials="JB" />
    </div>
  ),
};
