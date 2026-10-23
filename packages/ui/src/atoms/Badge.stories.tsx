import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./Badge";

const tones = ["neutral", "cream", "light", "gold", "success", "warning", "danger", "info"];

const meta = {
  title: "Atoms/Badge",
  component: Badge,
  args: { children: "Confirmed", tone: "success" },
  argTypes: { tone: { control: "select", options: tones } },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const AllTones: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, maxWidth: 500 }}>
      {tones.map((tone) => <Badge key={tone} tone={tone}>{tone}</Badge>)}
    </div>
  ),
};
