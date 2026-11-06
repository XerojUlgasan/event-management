# Components and Storybook

- Components are `.tsx` files within `packages/ui/src/<layer>/`. Look at neighboring files for prop, export, CSS class, and composition patterns. Keep public props narrow and usable from the web app.
- Use the [Clemora UI skill](../../frontend/clemora-ui/SKILL.md) for component selection and the [Storybook authoring guide](../../../packages/ui/STORYBOOK.md) for public-import examples and state coverage. Stories consume `@event-management/ui`, while shared implementation files may use relative internal imports.
- Storybook config is in `packages/ui/.storybook/`; it discovers `src/**/*.stories.ts(x)` and uses `@storybook/react-vite`. Stories live beside the component, for example `atoms/Button.stories.tsx`.
- When adding or changing a reusable component, add or update meaningful stories for its visible states and important interaction or prop variations. A story illustrates the public component; it does not replace behavior verification.
- Review affected imports from `apps/web` when renaming an export, prop, or CSS class. A shared package change can affect public and workspace views on `/`.
