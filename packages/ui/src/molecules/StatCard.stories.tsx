import type { Meta, StoryObj } from "@storybook/react-vite";

import { StatCard } from "./StatCard";

const meta = {
  title: "Molecules/StatCard",
  component: StatCard,
  args: {
    label: "Confirmed bookings",
    value: "148",
    change: "+12.4%",
    detail: "vs previous period",
  },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithoutChange: Story = {
  args: { change: undefined, detail: "Updated 2 hours ago" },
};
