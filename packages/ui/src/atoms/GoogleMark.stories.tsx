import type { Meta, StoryObj } from "@storybook/react-vite";
import { GoogleMark } from "@event-management/ui";

const meta = {
  title: "Atoms/GoogleMark",
  component: GoogleMark,
  args: { width: 24, height: 24 },
} satisfies Meta<typeof GoogleMark>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
