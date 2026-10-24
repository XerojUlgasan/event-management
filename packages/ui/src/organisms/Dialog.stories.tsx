import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "../atoms/Button";
import { FormField } from "../molecules/FormField";
import { Dialog } from "./Dialog";

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
          <input placeholder="e.g. Mendoza Anniversary" />
        </FormField>
        <FormField label="Guest count">
          <input type="number" defaultValue={50} />
        </FormField>
        <FormField className="full" label="Venue">
          <input placeholder="Venue name or location" />
        </FormField>
      </div>
    ),
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
