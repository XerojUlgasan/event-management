import type { Meta, StoryObj } from "@storybook/react-vite";

import { FormField } from "./FormField";

const meta = {
  title: "Molecules/FormField",
  component: FormField,
  args: {
    label: "Event name",
    children: <input placeholder="e.g. Mendoza Anniversary" />,
  },
  decorators: [
    (Story) => (
      <div className="form-grid" style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {};
export const FullWidth: Story = {
  args: {
    className: "full",
    label: "Venue",
    children: <input placeholder="Venue name or location" />,
  },
};
export const Select: Story = {
  args: {
    label: "Event type",
    children: (
      <select defaultValue="Wedding">
        <option>Wedding</option>
        <option>Birthday</option>
        <option>Corporate event</option>
      </select>
    ),
  },
};
