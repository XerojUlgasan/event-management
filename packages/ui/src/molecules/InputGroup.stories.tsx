import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Button,
  FormField,
  Icon,
  Input,
  InputGroup,
} from "@event-management/ui";

const meta = {
  title: "Molecules/InputGroup",
  component: InputGroup,
} satisfies Meta<typeof InputGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithIcon: Story = {
  render: () => (
    <InputGroup leading={<Icon name="users" />}>
      <Input
        variant="plain"
        type="email"
        aria-label="Email address"
        placeholder="you@example.com"
      />
    </InputGroup>
  ),
};

export const WithAction: Story = {
  render: () => (
    <InputGroup
      leading={<Icon name="search" />}
      trailing={
        <Button variant="light" size="small">
          Search
        </Button>
      }
    >
      <Input variant="plain" type="search" aria-label="Search" />
    </InputGroup>
  ),
};

export const Invalid: Story = {
  render: () => (
    <FormField label="Email address" error="Enter a valid email address.">
      {(field) => (
        <InputGroup leading={<Icon name="users" />}>
          <Input
            {...field}
            variant="plain"
            type="email"
            defaultValue="example"
          />
        </InputGroup>
      )}
    </FormField>
  ),
};

export const Disabled: Story = {
  render: () => (
    <InputGroup leading={<Icon name="search" />}>
      <Input
        variant="plain"
        disabled
        aria-label="Unavailable search"
        value="Search unavailable"
      />
    </InputGroup>
  ),
};
