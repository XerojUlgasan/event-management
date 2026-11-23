import { useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, MonthCalendar } from "@event-management/ui";

const meta = {
  title: "Organisms/MonthCalendar",
  component: MonthCalendar,
  args: {
    month: "2026-11",
    onMonthChange: () => undefined,
    onDateSelect: () => undefined,
  },
} satisfies Meta<typeof MonthCalendar>;

export default meta;

type Story = StoryObj<typeof meta>;

function Interactive(args: ComponentProps<typeof MonthCalendar>) {
  const [month, setMonth] = useState(args.month);
  const [selected, setSelected] = useState<string>();

  return (
    <MonthCalendar
      {...args}
      month={month}
      onMonthChange={setMonth}
      selectedDate={selected}
      onDateSelect={(date) =>
        setSelected((current) => (current === date ? undefined : date))
      }
    />
  );
}

export const WithCounts: Story = {
  args: {
    counts: { "2026-11-03": 1, "2026-11-12": 3, "2026-11-21": 5 },
    caption: "Select a date to filter the list.",
  },
  render: (args) => <Interactive {...args} />,
};

export const EmptyCompact: Story = {
  render: (args) => (
    <div style={{ maxWidth: 340 }}>
      <Interactive {...args} />
    </div>
  ),
};

export const Loading: Story = {
  args: { loading: true },
  render: (args) => <Interactive {...args} />,
};

export const Error: Story = {
  args: {
    error: (
      <>
        Could not load event days.{" "}
        <Button variant="secondary" size="small">
          Try again
        </Button>
      </>
    ),
  },
  render: (args) => <Interactive {...args} />,
};
