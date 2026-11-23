import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";
import { FormField, Input, Select, Textarea } from "@event-management/ui";

const meta = { title: "Atoms/Controls", component: Input } satisfies Meta<
  typeof Input
>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Text: Story = {
  args: { placeholder: "Your name", "aria-label": "Your name" },
};

export const FormControls: Story = {
  render: () => {
    const fileRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState("");

    return (
      <div style={{ display: "grid", gap: 12, maxWidth: 360 }}>
        <label>
          Name
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <label>
          Notes
          <Textarea placeholder="Add details" />
        </label>
        <label>
          Event type
          <Select defaultValue="wedding">
            <option value="wedding">Wedding</option>
            <option value="birthday">Birthday</option>
          </Select>
        </label>
        <label>
          Choose photos
          <Input
            variant="plain"
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
          />
        </label>
      </div>
    );
  },
};

export const Disabled: Story = {
  args: { value: "Unavailable", disabled: true, "aria-label": "Unavailable" },
};

export const FeedbackStates: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 16, width: "min(100%, 360px)" }}>
      <FormField label="Contact name" error="Enter the contact person's name.">
        {(field) => <Input {...field} />}
      </FormField>
      <FormField label="Event type" error="Choose an event type.">
        {(field) => (
          <Select {...field} defaultValue="">
            <option value="">Choose a type</option>
            <option value="wedding">Wedding</option>
          </Select>
        )}
      </FormField>
      <FormField label="Notes" error="Shorten the notes before continuing.">
        {(field) => (
          <Textarea {...field} defaultValue="A note that needs attention." />
        )}
      </FormField>
      <FormField
        label="Request reference"
        description="This reference cannot be edited."
      >
        {(field) => <Input {...field} readOnly value="CLM-2048" />}
      </FormField>
      <FormField label="Unavailable event type">
        <Select disabled defaultValue="wedding">
          <option value="wedding">Wedding</option>
        </Select>
      </FormField>
      <FormField label="Unavailable notes">
        <Textarea disabled defaultValue="Notes are unavailable." />
      </FormField>
    </div>
  ),
};
