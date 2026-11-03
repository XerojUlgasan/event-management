# Naming in Clemora

| Element | Current convention |
| --- | --- |
| API operation files and domain folders | kebab-case, such as `controllers/packages/create-package.ts` |
| React component and story files | Existing PascalCase pattern, such as `Button.tsx` and `Button.stories.tsx` |
| Functions, variables, and Zod schemas | camelCase |
| Types and classes | PascalCase |
| PostgreSQL tables and columns | snake_case |
| API request and response fields | Preserve the current camelCase contract, such as `maxGuests` and `expectedUpdatedAt` |

Use the [API layout](../api/reference/structure-and-routes.md) for layer suffixes and route registration. Use the [frontend structure](frontend-project-structure.md) for React placement. Do not rename existing components or JSON fields merely to conform to another project's convention. Coordinate a requested contract change through [API synchronization](api-type-sync.md).
