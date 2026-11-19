import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  Button,
  FormField,
  Input,
  InputGroup,
  Select as SelectControl,
  Textarea,
} from "@event-management/ui";

const meta = {
  title: "Molecules/FormField",
  component: FormField,
  args: { label: "Contact name" },
  decorators: [
    (Story) => (
      <div style={{ width: "min(420px, 100vw - 48px)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FormField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Text: Story = {
  args: {
    children: (field) => (
      <Input {...field} name="contactName" autoComplete="name" />
    ),
  },
};

export const HelpAndError: Story = {
  args: {
    description: "Use the name the admin should use when contacting you.",
    error: "Enter a contact name.",
    children: (field) => <Input {...field} name="contactName" required />,
  },
};

export const Disabled: Story = {
  args: {
    description: "Contact information is read-only in this example.",
    children: (field) => <Input {...field} value="Sample customer" disabled />,
  },
};

export const LongFeedback: Story = {
  args: {
    label: "Special requests or services",
    description:
      "Describe any services the admin should discuss with you before preparing a quotation.",
    error:
      "Please shorten this request and keep any additional details for your conversation with the admin.",
    children: (field) => <Textarea {...field} name="specialRequests" />,
  },
};

export const FullWidth: Story = {
  args: {
    label: "Venue",
    className: "full",
    children: (field) => (
      <Input {...field} name="venue" placeholder="Venue name or location" />
    ),
  },
  decorators: [
    (Story) => (
      <div className="form-grid">
        <Story />
      </div>
    ),
  ],
};

export const Select: Story = {
  args: {
    label: "Event type",
    children: (field) => (
      <SelectControl {...field} defaultValue="wedding">
        <option value="wedding">Wedding</option>
        <option value="birthday">Birthday</option>
      </SelectControl>
    ),
  },
};

export const GroupedControl: Story = {
  args: {
    label: "Guest estimate",
    description: "An estimate is sufficient for this example.",
    children: (field) => (
      <InputGroup trailing={<span>guests</span>}>
        <Input {...field} variant="plain" type="number" min={1} />
      </InputGroup>
    ),
  },
};

export const LegacyChildren: Story = {
  args: {
    label: "Contact name",
    children: (
      <Input name="contactName" placeholder="Implicitly labelled control" />
    ),
  },
};

export const Interactive: Story = {
  render: () => {
    const [name, setName] = useState("");
    const [checked, setChecked] = useState(false);
    const error = checked && !name.trim() ? "Enter a contact name." : undefined;

    return (
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setChecked(true);
        }}
        style={{ display: "grid", gap: 16 }}
      >
        <FormField
          label="Contact name"
          description="This example keeps changes in local state."
          error={error}
        >
          {(field) => (
            <Input
              {...field}
              name="contactName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          )}
        </FormField>
        <Button type="submit">Check details</Button>
        {checked && !error && (
          <p role="status">Details are ready for review.</p>
        )}
      </form>
    );
  },
};
