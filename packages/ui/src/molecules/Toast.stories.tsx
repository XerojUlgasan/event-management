import type { Meta, StoryObj } from "@storybook/react-vite";

import { Toast } from "@event-management/ui";

const meta = {
  title: "Molecules/Toast",
  component: Toast,
  args: { children: "Booking CLM-2048 saved" },
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {};
export const Info: Story = { args: { tone: "info", children: "Your request is being reviewed." } };
export const InlineError: Story = { args: { tone: "danger", placement: "inline", children: <>The catalog is unavailable right now. <a href="?retry">Try again</a></> } };
export const Error: Story = { args: { tone: "danger", children: "Unable to start a conversation. Try again." } };
export const LongMessage: Story = { args: { tone: "danger", children: "Unable to start a conversation because the connection was interrupted. Check your connection and try again." } };
export const CustomIcon: Story = {
  args: { icon: "alert", children: "Something needs your attention" },
};
