import type { Meta, StoryObj } from "@storybook/react-vite";

import { Toast } from "./Toast";

const meta = {
  title: "Molecules/Toast",
  component: Toast,
  args: { children: "Booking CLM-2048 saved" },
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {};
export const CustomIcon: Story = {
  args: { icon: "alert", children: "Something needs your attention" },
};
