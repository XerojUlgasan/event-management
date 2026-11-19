import type { Meta, StoryObj } from "@storybook/react-vite";
import { Markdown } from "@event-management/ui";

const source = `## Your celebration

We can help with **styling**, *catering*, and [event details](https://example.com).

- Ceremony
- Reception

1. Share your preferred date.
2. Tell us your guest count.

> Your inquiry does not reserve a date.

Use \`Shift+Enter\` for a new line.`;

const meta = {
  title: "Molecules/Markdown",
  component: Markdown,
  args: { source },
} satisfies Meta<typeof Markdown>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Document: Story = {};
export const Message: Story = {
  args: { variant: "message" },
  decorators: [
    (Story) => (
      <div
        style={{
          maxWidth: 360,
          padding: 16,
          background: "var(--surface-base)",
          color: "var(--text-primary)",
          fontSize: 14,
          lineHeight: 1.65,
        }}
      >
        <Story />
      </div>
    ),
  ],
};
export const OwnMessage: Story = {
  ...Message,
  decorators: [
    (Story) => (
      <div
        style={{
          maxWidth: 280,
          padding: 16,
          background: "var(--wine)",
          color: "var(--surface-base)",
          fontSize: 14,
          lineHeight: 1.65,
        }}
      >
        <Story />
      </div>
    ),
  ],
};
export const PlainMultiline: Story = {
  ...Message,
  args: {
    variant: "message",
    source:
      "Hello!\nOur event is in June.\n\nFirst line with a Markdown hard break.  \nSecond line.\n\nThank you.",
  },
};
export const NarrowOverflow: Story = {
  ...OwnMessage,
  args: {
    variant: "message",
    source: `${source}\n\n| Package | Details |\n| --- | --- |\n| Celebration | ${"Long details ".repeat(20)} |\n\n\`\`\`text\n${"wide content ".repeat(30)}\n\`\`\`\n\nhttps://example.com/${"long-path-".repeat(25)}`,
  },
};
export const Sanitized: Story = {
  ...Message,
  args: {
    variant: "message",
    source:
      '**Safe text**\n\n<script>alert("unsafe")</script>\n\n[Unsafe link](javascript:alert(1))\n\n![Image description](https://example.com/image.png)',
  },
};
