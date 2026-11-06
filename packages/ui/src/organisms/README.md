# Organisms

Larger reusable interface sections composed from atoms and molecules.

- `PageHeader` — semantic page heading (`h1`, or `h2`/`h3` with `titleAs`), description, and actions.
- `Dialog` — mounted native modal with title/description, guarded dismissal requests, initial focus ref, and focus restoration.
- `NativeDialog` — native dialog with forwarded props and ref. Its caller controls the modal lifecycle, focus, and close behavior.
- `Drawer` — mounted native modal detail panel with a required title, optional status, dismissal requests, and focus restoration.

`ModalSurface` is a private implementation shared by `Dialog` and `Drawer`; it is not a public export. App callers use the public wrappers or lifecycle-neutral `NativeDialog`.
