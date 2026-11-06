import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button, PageHeader } from "@event-management/ui";

const meta = {
  title: "Organisms/PageHeader",
  component: PageHeader,
  args: {
    title: "Bookings",
    description: "Manage every confirmed and prospective event in one place.",
    actions: <Button icon="clipboard">Create booking</Button>,
  },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div style={{ padding: 32, maxWidth: 900 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const SectionHeading: Story = { args: { titleAs: "h2", title: "Upcoming events" } };
export const WithEyebrow: Story = {
  args: {
    className: "welcome-row",
    eyebrow: "Monday, June 16",
    title: "Good morning, Marin",
    description: "You have 2 assigned events and 5 tasks this week.",
    actions: <Button icon="calendar">View my schedule</Button>,
  },
};
