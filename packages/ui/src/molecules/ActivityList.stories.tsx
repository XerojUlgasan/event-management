import type { Meta, StoryObj } from "@storybook/react-vite";

import { ActivityList } from "@event-management/ui";

const meta = {
  title: "Molecules/ActivityList",
  component: ActivityList,
  args: {
    items: [
      {
        title: "Booking status updated",
        detail: "Mendoza–Reyes Wedding · 12 min ago",
      },
      { title: "Quotation approved", detail: "Q-2048 · June 8, 2025" },
      { title: "Message received", detail: "Conversation with Amina Santos" },
    ],
  },
} satisfies Meta<typeof ActivityList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
