import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DateSelect, FormField } from "@event-management/ui";

const meta = {
  title: "Molecules/DateSelect",
  component: DateSelect,
  args: {
    centerDate: "2026-11-20",
    value: "2026-11-20",
    onChange: () => {},
    "aria-label": "Task date",
  },
} satisfies Meta<typeof DateSelect>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value);

    return (
      <div style={{ maxWidth: 380, paddingBottom: 240 }}>
        <FormField label="Task date">
          {(field) => (
            <DateSelect
              {...args}
              {...field}
              value={value}
              onChange={setValue}
            />
          )}
        </FormField>
      </div>
    );
  },
};

export const PreparationDate: Story = {
  ...Interactive,
  args: { value: "2026-11-19" },
};

export const Disabled: Story = { args: { disabled: true } };
