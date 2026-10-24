import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Tabs } from "./Tabs";

const meta = {
  title: "Molecules/Tabs",
  component: Tabs,
  args: {
    items: [
      { value: "all", label: "All bookings", count: 28 },
      { value: "action", label: "Needs action", count: 7 },
      { value: "upcoming", label: "Upcoming" },
    ],
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

function InteractiveTabs() {
  const [active, setActive] = useState("all");
  return (
    <Tabs
      active={active}
      onChange={setActive}
      items={[
        { value: "all", label: "All bookings", count: 28 },
        { value: "action", label: "Needs action", count: 7 },
        { value: "upcoming", label: "Upcoming" },
      ]}
    />
  );
}

export const Default: Story = { args: { active: "all" } };
export const Interactive: Story = {
  args: { active: "all" },
  render: () => <InteractiveTabs />,
};
