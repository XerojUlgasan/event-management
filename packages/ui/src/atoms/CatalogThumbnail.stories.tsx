import type { Meta, StoryObj } from "@storybook/react-vite";
import { CatalogThumbnail } from "@event-management/ui";

const meta = {
  title: "Atoms/CatalogThumbnail",
  component: CatalogThumbnail,
  decorators: [
    (Story) => (
      <div style={{ width: 320, height: 225 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CatalogThumbnail>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithImage: Story = {
  args: {
    src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 225'%3E%3Crect width='320' height='225' fill='%23d8d0ca'/%3E%3Ccircle cx='160' cy='112' r='55' fill='%2371645a'/%3E%3C/svg%3E",
  },
};

export const BrokenImage: Story = { args: { src: "/missing-thumbnail.jpg" } };
