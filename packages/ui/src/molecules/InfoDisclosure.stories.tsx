import type { Meta, StoryObj } from "@storybook/react-vite";
import { InfoDisclosure } from "@event-management/ui";

const meta = {
  title: "Molecules/InfoDisclosure",
  component: InfoDisclosure,
  args: {
    label: "More information",
    hint: "A short explanation",
    children: <p>Additional details remain visible until dismissed.</p>,
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 40, display: "flex", justifyContent: "center" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InfoDisclosure>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const LongContent: Story = {
  args: {
    hint: "Longer details",
    children: (
      <p>
        A longer explanation can wrap inside the panel, including on a narrow
        screen.
      </p>
    ),
  },
};
