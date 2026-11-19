import type { Meta, StoryObj } from "@storybook/react-vite";

import { useState, type ComponentProps } from "react";

import { Badge, Button, Dialog, Drawer } from "@event-management/ui";

const meta = {
  title: "Organisms/Drawer",
  component: Drawer,
  args: {
    onClose: () => undefined,
    title: "Mendoza–Reyes Wedding",
    status: <Badge tone="success">Confirmed</Badge>,
    children: (
      <>
        <p>Saturday, June 22, 2025 · 180 guests</p>
        <div className="detail-grid">
          <div>
            <span>Venue</span>
            <strong>The Glass Garden</strong>
          </div>
          <div>
            <span>Customer contact</span>
            <strong>Isabel Mendoza-Reyes</strong>
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

function Example(args: ComponentProps<typeof Drawer>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open details</Button>
      {open && <Drawer {...args} onClose={() => setOpen(false)} />}
    </>
  );
}

export const Default: Story = { render: (args) => <Example {...args} /> };

export const LongContent: Story = {
  args: {
    title:
      "A long event name that should wrap without covering the close button",
    children: (
      <>
        {Array.from({ length: 25 }, (_, i) => (
          <p key={i}>
            Detail {i + 1}: Confirm the contact and venue arrangements.
          </p>
        ))}
        <Button variant="secondary">Last action</Button>
      </>
    ),
  },
  render: (args) => <Example {...args} />,
};

function Handoff() {
  const [stage, setStage] = useState<"closed" | "drawer" | "dialog">("closed");

  return (
    <>
      <Button onClick={() => setStage("drawer")}>Open item details</Button>
      {stage === "drawer" && (
        <Drawer title="Table linens" onClose={() => setStage("closed")}>
          <p>Review the available stock.</p>
          <Button onClick={() => setStage("dialog")}>Allocate item</Button>
        </Drawer>
      )}
      {stage === "dialog" && (
        <Dialog title="Allocate inventory" onClose={() => setStage("closed")}>
          <p>The detail panel has closed. Focus belongs to this dialog.</p>
          <Button variant="secondary" onClick={() => setStage("closed")}>
            Cancel
          </Button>
        </Dialog>
      )}
    </>
  );
}

export const DialogHandoff: Story = { render: () => <Handoff /> };
