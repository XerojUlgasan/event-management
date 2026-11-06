import type { Meta, StoryObj } from "@storybook/react-vite";

import { useRef, useState, type ComponentProps } from "react";

import { Button, Dialog, FormField, Input } from "@event-management/ui";

const meta = {
  title: "Organisms/Dialog",
  component: Dialog,
  args: {
    eyebrow: "Booking record",
    title: "Create booking",
    intro: "Add the essentials now. Details can be refined later.",
    onClose: () => undefined,
    actions: (
      <>
        <Button variant="secondary">Cancel</Button>
        <Button>Save booking</Button>
      </>
    ),
    children: (
      <div className="form-grid">
        <FormField label="Event name">
          <Input placeholder="e.g. Mendoza Anniversary" />
        </FormField>
        <FormField label="Guest count">
          <Input type="number" defaultValue={50} />
        </FormField>
        <FormField className="full" label="Venue">
          <Input placeholder="Venue name or location" />
        </FormField>
      </div>
    ),
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

function Example(args: ComponentProps<typeof Dialog>) {
  const [open, setOpen] = useState(false);
  return <><Button onClick={() => setOpen(true)}>Open dialog</Button>{open && <Dialog {...args} onClose={() => setOpen(false)} actions={<Button variant="secondary" onClick={() => setOpen(false)}>Done</Button>} />}</>;
}

export const Default: Story = { render: args => <Example {...args} /> };
export const RichTitle: Story = { args: { title: <>Review <em>event details</em></> }, render: args => <Example {...args} /> };
export const LongContent: Story = {
  args: { title: "Review the complete event plan", children: <>{Array.from({ length: 20 }, (_, i) => <p key={i}>Section {i + 1}: Review the venue, schedule, and contact details before continuing.</p>)}</> },
  render: args => <Example {...args} />,
};

function BusyExample() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(true);
  return <><Button onClick={() => setOpen(true)}>Open guarded dialog</Button>{open && <Dialog title="Save in progress" intro="Dismissal is blocked while the checkbox is checked." onClose={() => { if (!busy) setOpen(false); }}>
    <FormField label="Saving"><Input variant="plain" type="checkbox" checked={busy} onChange={event => setBusy(event.target.checked)} /></FormField>
    <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Done</Button>
  </Dialog>}</>;
}
export const BusyDismissal: Story = { render: () => <BusyExample /> };

function FocusExample() {
  const input = useRef<HTMLInputElement>(null);
  return <Example title="Contact details" onClose={() => undefined} initialFocus={input}>
    <FormField label="Contact name"><Input ref={input} /></FormField>
  </Example>;
}
export const InitialFocus: Story = { render: () => <FocusExample /> };
