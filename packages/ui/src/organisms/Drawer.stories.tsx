import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge } from "../atoms/Badge";
import { Button } from "../atoms/Button";
import { Drawer } from "./Drawer";

const meta = {
  title: "Organisms/Drawer",
  component: Drawer,
  args: {
    onClose: () => undefined,
    children: (
      <>
        <Badge tone="success">Confirmed</Badge>
        <div className="drawer-title">Mendoza–Reyes Wedding</div>
        <p>Saturday, June 22, 2025 · 180 guests</p>
        <div className="detail-grid">
          <div>
            <span>Venue</span>
            <strong>The Glass Garden</strong>
          </div>
          <div>
            <span>Coordinator</span>
            <strong>Amina Santos</strong>
          </div>
        </div>
        <div className="drawer-actions">
          <Button variant="secondary">Duplicate</Button>
          <Button>Edit booking</Button>
        </div>
      </>
    ),
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
