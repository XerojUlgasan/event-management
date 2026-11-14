import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Badge,
  Button,
  DataTable,
  Select,
  type DataTableColumn,
} from "@event-management/ui";

type RequestRow = {
  id: string;
  customerName: string;
  eventType: "wedding" | "birthday";
  status: "under_review" | "accepted";
};

const rows: RequestRow[] = [
  {
    id: "request-142",
    customerName: "Ana Santos",
    eventType: "wedding",
    status: "accepted",
  },
  {
    id: "request-143",
    customerName: "Miguel Flores",
    eventType: "birthday",
    status: "under_review",
  },
];
const columns: DataTableColumn<RequestRow>[] = [
  {
    key: "customer",
    header: "Customer",
    cell: (row) => row.customerName,
  },
  {
    key: "status",
    header: "Request status",
    cell: (row) => (
      <Badge tone={row.status === "accepted" ? "success" : "warning"}>
        {row.status === "accepted" ? "Accepted" : "Under review"}
      </Badge>
    ),
  },
  {
    key: "event-type",
    header: "Event type",
    cell: (row) => (
      <Select
        aria-label={`Event type for ${row.customerName}`}
        defaultValue={row.eventType}
      >
        <option value="wedding">Wedding</option>
        <option value="birthday">Birthday</option>
      </Select>
    ),
  },
  {
    key: "admin-action",
    header: "Admin action",
    cell: () => (
      <Button size="small" disabled>
        Review request
      </Button>
    ),
  },
];

const meta = {
  title: "Organisms/DataTable",
  component: DataTable<RequestRow>,
  args: {
    label: "Customer booking requests",
    columns,
    rows,
    rowKey: (row) => row.id,
    emptyMessage: "No booking requests are available for review.",
    minWidth: 850,
  },
} satisfies Meta<typeof DataTable<RequestRow>>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { rows: [] } };
export const Narrow: Story = {
  render: (args) => (
    <div style={{ maxWidth: 360 }}>
      <DataTable {...args} />
    </div>
  ),
};
export const LongNames: Story = {
  args: {
    rows: [
      {
        ...rows[0],
        customerName: "Maria Isabel Delos Santos Fernandez",
        id: "long-name",
      },
      {
        ...rows[1],
        customerName: "AlexandriaMontgomerySantosVillanueva",
        id: "unbroken-name",
      },
    ],
  },
  render: (args) => (
    <div style={{ maxWidth: 360 }}>
      <DataTable {...args} />
    </div>
  ),
};
