import type { Meta, StoryObj } from "@storybook/react-vite";
import { Brand } from "@event-management/ui";

const meta = {
  title: "Molecules/Brand",
  component: Brand,
  args: { light: false },
} satisfies Meta<typeof Brand>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Light: Story = {
  args: { light: true },
  decorators: [(Story) => <div style={{ padding: 24, background: "var(--wine)", borderRadius: 12 }}><Story /></div>],
};
