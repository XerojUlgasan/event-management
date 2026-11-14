import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pagination } from "@event-management/ui";
const meta = {
  title: "Molecules/Pagination",
  component: Pagination,
  args: {
    page: 1,
    hasNextPage: true,
    onPrevious: () => {},
    onNext: () => {},
    label: "Customer results pages",
  },
} satisfies Meta<typeof Pagination>;
export default meta;
type Story = StoryObj<typeof meta>;
export const FirstPage: Story = {};
export const MiddlePage: Story = { args: { page: 2 } };
export const LastPage: Story = { args: { page: 3, hasNextPage: false } };
export const Empty: Story = { args: { hasNextPage: false } };
export const Loading: Story = { args: { page: 2, pending: true } };
export const Disabled: Story = { args: { page: 2, disabled: true } };
export const ServerLinks: Story = {
  render: () => (
    <Pagination
      page={2}
      hasNextPage
      previousHref="?page=1"
      nextHref="?page=3"
    />
  ),
};
function InteractivePagination() {
  const [page, setPage] = useState(1);
  return (
    <div style={{ maxWidth: 300 }}>
      <p>Customer results, page {page}.</p>
      <Pagination
        page={page}
        hasNextPage={page < 3}
        onPrevious={() => setPage((value) => value - 1)}
        onNext={() => setPage((value) => value + 1)}
      />
    </div>
  );
}
export const InteractiveNarrow: Story = {
  render: () => <InteractivePagination />,
};
