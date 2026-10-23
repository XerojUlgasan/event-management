import type { Meta, StoryObj } from "@storybook/react-vite";
import { Icon } from "./Icon";

const names = ["grid", "calendar", "users", "box", "chart", "settings", "search", "bell", "spark", "chevron", "check", "arrow", "clipboard", "alert", "menu", "close"];

const meta = {
  title: "Atoms/Icon",
  component: Icon,
  args: { name: "spark", size: 24 },
  argTypes: { name: { control: "select", options: names } },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Gallery: Story = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(90px, 1fr))", gap: 24 }}>
      {names.map((name) => (
        <div key={name} style={{ display: "grid", justifyItems: "center", gap: 8 }}>
          <Icon name={name} size={24} />
          <span style={{ fontSize: 12 }}>{name}</span>
        </div>
      ))}
    </div>
  ),
};
