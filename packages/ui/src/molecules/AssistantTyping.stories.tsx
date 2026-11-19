import type { Meta, StoryObj } from "@storybook/react-vite";
import { AssistantTyping } from "@event-management/ui";

const meta = {
  title: "Molecules/AssistantTyping",
  component: AssistantTyping,
} satisfies Meta<typeof AssistantTyping>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
