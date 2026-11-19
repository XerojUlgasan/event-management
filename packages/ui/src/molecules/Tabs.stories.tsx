import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Tabs } from "@event-management/ui";

const meta = {
  title: "Molecules/Tabs",
  component: Tabs,
  args: {
    "aria-label": "Booking filters",
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

export const Segmented: Story = {
  args: {
    active: "all",
    variant: "segmented",
    role: "group",
    "aria-label": "Booking filters",
  },
};

function TabPanels() {
  const [active, setActive] = useState("details");
  const items = [
    {
      value: "details",
      label: "Details",
      id: "example-details-tab",
      panelId: "example-details-panel",
    },
    {
      value: "unavailable",
      label: "Unavailable",
      disabled: true,
      id: "example-unavailable-tab",
      panelId: "example-unavailable-panel",
    },
    {
      value: "notes",
      label: "Notes",
      id: "example-notes-tab",
      panelId: "example-notes-panel",
    },
  ];

  return (
    <div style={{ width: "min(100%, 480px)" }}>
      <Tabs
        role="tablist"
        aria-label="Event information"
        items={items}
        active={active}
        onChange={setActive}
      />
      {items.map((item) => (
        <div
          key={item.value}
          role="tabpanel"
          id={item.panelId}
          aria-labelledby={item.id}
          hidden={item.value !== active}
          tabIndex={0}
          style={{ paddingBlock: 16 }}
        >
          {item.value === "details"
            ? "Venue and schedule details."
            : item.value === "notes"
              ? "Preparation notes for the event."
              : "This section is unavailable."}
        </div>
      ))}
    </div>
  );
}

export const TabList: Story = {
  args: { active: "all" },
  render: () => <TabPanels />,
};

export const DisabledItem: Story = {
  args: {
    active: "all",
    role: "group",
    "aria-label": "Booking filters",
    items: [
      { value: "all", label: "All bookings" },
      { value: "unavailable", label: "Unavailable", disabled: true },
    ],
  },
};

export const Interactive: Story = {
  args: { active: "all" },
  render: () => <InteractiveTabs />,
};
