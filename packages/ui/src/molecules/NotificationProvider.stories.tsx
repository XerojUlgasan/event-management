import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button, Dialog, NotificationProvider, useNotifications } from "@event-management/ui";

const meta = { title: "Molecules/Notifications", component: NotificationProvider, args: { children: null } } satisfies Meta<typeof NotificationProvider>;
export default meta;
type Story = StoryObj<typeof meta>;

function Example({ modal = false }: { modal?: boolean }) {
  const { notify, notifyError } = useNotifications();
  const [open, setOpen] = useState(false);
  const [nested, setNested] = useState(false);
  const actions = <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
    <Button onClick={() => notify("Changes saved successfully.")}>Success</Button>
    <Button onClick={() => notify("Your request is being reviewed.", "info")}>Information</Button>
    <Button onClick={() => notifyError(new Error("Unable to save. Check your connection and try again."))}>Persistent error</Button>
    <Button onClick={() => notifyError(null, "Unable to complete this action. Try again.")}>Unknown error</Button>
    <Button onClick={() => notify("This is a longer notification explaining that your changes could not be saved because the connection was interrupted. Check your connection and try again when it is available.", "danger")}>Long message</Button>
  </div>;
  return <>{modal ? <><Button onClick={() => setOpen(true)}>Open dialog</Button>{open && <Dialog title="Notification in a dialog" onClose={() => setOpen(false)}>{actions}<Button onClick={() => setNested(true)}>Open nested dialog</Button>{nested && <Dialog title="Nested dialog" onClose={() => setNested(false)}>{actions}</Dialog>}</Dialog>}</> : actions}</>;
}

export const StackAndErrors: Story = { render: () => <NotificationProvider><Example /></NotificationProvider> };
export const NativeModal: Story = { render: () => <NotificationProvider><Example modal /></NotificationProvider> };
