# Database and migrations

- `apps/api/prisma/schema.prisma` and `prisma/migrations/` define schema changes. `prisma.config.ts` takes its connection URL from `src/db/config.ts`.
- Runtime route queries use Kysely through `src/db/client.ts` and focused files in `src/data/<domain>/`. Controllers receive `c.get("db")` and pass it to services; data functions accept it or a transaction. Database setup and seed commands remain in `src/db/`. The checked-in `src/db/types.ts` is generated from the migrated PostgreSQL database by `pnpm db:generate`. Do not hand-edit generated DB types.
- For a schema change, edit the Prisma schema, create and review a migration with `pnpm db:migrate`, regenerate Kysely types with `pnpm db:generate`, then update affected queries and run `pnpm check`. `pnpm db:deploy` applies committed migrations; it does not create one.
- Read existing migrations as well as the Prisma schema when changing constraints or data behavior. For example, the users migrations add email normalization/uniqueness behavior beyond the model declaration.
- `src/db/seed.ts` and `seed-admin.ts` are data setup commands, not migrations. Do not run a seed against a database without checking its target and impact.

Database commands use local settings from `apps/api/.env`. Use `.env.example` for variable names and keep values out of chat, docs, and logs.

Catalog versions store external HTTPS image URLs. Read [external catalog image URLs](external-image-urls.md) before changing image schema or migration behavior.
