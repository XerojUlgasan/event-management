import type { Meta, StoryObj } from "@storybook/react-vite";

import { SearchField } from "./SearchField";

const meta = {
  title: "Molecules/SearchField",
  component: SearchField,
  args: { placeholder: "Search events, customers, or bookings" },
} satisfies Meta<typeof SearchField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Compact: Story = { args: { compact: true, placeholder: "Search..." } };
