import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge, Icon, type BadgeTone } from "@event-management/ui";

const tones = ["neutral", "cream", "light", "gold", "success", "warning", "danger", "info", "accent"] satisfies BadgeTone[];

const meta = {
  title: "Atoms/Badge",
  component: Badge,
  args: { children: "Confirmed", tone: "success" },
  argTypes: { tone: { control: "select", options: tones } },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Counter: Story = { args: { tone: "accent", variant: "counter", children: "3", "aria-label": "3 unread messages" } };
export const WithIcon: Story = {
  args: { "aria-label": "Status: Confirmed" },
  render: (args) => <Badge {...args}><Icon name="check" size={12} />{args.children}</Badge>,
};
export const AllTones: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, maxWidth: 500 }}>
      {tones.map((tone) => <Badge key={tone} tone={tone}>{tone}</Badge>)}
    </div>
  ),
};
