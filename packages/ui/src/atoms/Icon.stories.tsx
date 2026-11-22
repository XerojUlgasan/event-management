import type { Meta, StoryObj } from "@storybook/react-vite";
import { Icon, type IconName } from "@event-management/ui";

const names = [
  "grid",
  "calendar",
  "users",
  "message",
  "box",
  "chart",
  "settings",
  "spinner",
  "refresh",
  "search",
  "filter",
  "bell",
  "spark",
  "chevron",
  "check",
  "arrow",
  "clipboard",
  "alert",
  "card",
  "bank",
  "menu",
  "close",
  "more",
  "info",
  "help",
  "clock",
  "location",
  "camera",
  "image",
  "text",
  "video",
  "grip",
  "eye",
  "plus",
  "minus",
  "edit",
  "save",
  "trash",
  "undo",
  "redo",
] satisfies IconName[];

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
    <div
      style={{
        display: "grid",
        width: "min(480px, calc(100vw - 32px))",
        gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
        gap: 24,
      }}
    >
      {names.map((name) => (
        <div
          key={name}
          style={{ display: "grid", justifyItems: "center", gap: 8 }}
        >
          <Icon name={name} size={24} />
          <span style={{ fontSize: 12 }}>{name}</span>
        </div>
      ))}
    </div>
  ),
};
