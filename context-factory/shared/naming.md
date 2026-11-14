# Naming in Clemora

| Element | Current convention |
| --- | --- |
| API operation files and domain folders | kebab-case, such as `controllers/packages/create-package.ts` |
| React component and story files | PascalCase; primary components match their filenames, with the cohesive group exceptions in the frontend structure guide |
| Functions, variables, and Zod schemas | camelCase |
| Types and classes | PascalCase |
| PostgreSQL tables and columns | snake_case |
| API request and response fields | Preserve the current camelCase contract, such as `maxGuests` and `expectedUpdatedAt` |

Use the [API layout](../api/reference/structure-and-routes.md) for layer suffixes and route registration. Use the [frontend structure](frontend-project-structure.md) for React placement. Follow its web-specific naming matrix when adding or moving files. Preserve existing JSON fields. Coordinate a requested contract change through [API synchronization](api-type-sync.md).
