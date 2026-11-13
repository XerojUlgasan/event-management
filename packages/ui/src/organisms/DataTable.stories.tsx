import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge, Button, DataTable, Select, type DataTableColumn } from "@event-management/ui";

type StaffRow = { id: string; name: string; role: "coordinator" | "helper"; confirmed: boolean };

const rows: StaffRow[] = [
  { id: "miguel", name: "Miguel Flores", role: "coordinator", confirmed: true },
  { id: "isabel", name: "Isabel Torres", role: "helper", confirmed: false },
];
const columns: DataTableColumn<StaffRow>[] = [
  { key: "name", header: "Staff member", cell: row => row.name },
  { key: "response", header: "Response", cell: () => <Badge tone="success">Available</Badge> },
  { key: "role", header: "Role", cell: row => <Select aria-label={`Role for ${row.name}`} defaultValue={row.role} disabled={row.confirmed}><option value="helper">Helper</option><option value="coordinator">Coordinator</option></Select> },
  { key: "assignment", header: "Assignment", cell: row => row.confirmed ? `Confirmed ${row.role}` : "Not assigned" },
  { key: "actions", header: "Actions", cell: () => <Button size="small" disabled>Example action</Button> },
];

const meta = {
  title: "Organisms/DataTable",
  component: DataTable<StaffRow>,
  args: { label: "Available staff", columns, rows, rowKey: row => row.id, emptyMessage: "No staff have responded as available yet.", minWidth: 850 },
} satisfies Meta<typeof DataTable<StaffRow>>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { rows: [] } };
export const Narrow: Story = { render: args => <div style={{ maxWidth: 360 }}><DataTable {...args} /></div> };
export const LongNames: Story = {
  args: { rows: [{ ...rows[0], name: "Maria Isabel Delos Santos Fernandez", id: "long-name" }, { ...rows[1], name: "AlexandriaMontgomerySantosVillanueva", id: "unbroken-name" }] },
  render: args => <div style={{ maxWidth: 360 }}><DataTable {...args} /></div>,
};
