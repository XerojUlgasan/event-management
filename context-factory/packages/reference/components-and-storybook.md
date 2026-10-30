# Components and Storybook

- Components are `.tsx` files within `packages/ui/src/<layer>/`. Look at neighboring files for prop, export, CSS class, and composition patterns. Keep public props narrow and usable from the web app.
- Storybook config is in `packages/ui/.storybook/`; it discovers `src/**/*.stories.ts(x)` and uses `@storybook/react-vite`. Stories live beside the component, for example `atoms/Button.stories.tsx`.
- When adding or changing a reusable component, add or update meaningful stories for its visible states and important interaction or prop variations. A story illustrates the public component; it does not replace behavior verification.
- Review affected imports from `apps/web` when renaming an export, prop, or CSS class. A shared package change can affect both `/` and `/catalog`.
