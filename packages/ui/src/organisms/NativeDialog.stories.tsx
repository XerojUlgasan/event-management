import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef } from "react";
import { Button, NativeDialog } from "@event-management/ui";

const meta = {
  title: "Organisms/NativeDialog",
  component: NativeDialog,
} satisfies Meta<typeof NativeDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NativeModal: Story = {
  render: () => {
    const dialog = useRef<HTMLDialogElement>(null);

    return (
      <>
        <Button onClick={() => dialog.current?.showModal()}>Open dialog</Button>
        <NativeDialog ref={dialog} aria-label="Example dialog">
          <div style={{ padding: 24 }}>
            <p>Native dialog content</p>
            <Button onClick={() => dialog.current?.close()}>Close</Button>
          </div>
        </NativeDialog>
      </>
    );
  },
};
