# Shared package ownership

Use the existing owners before introducing a package:

- [contracts](../../packages/contracts/package.json) owns reusable catalog types and domain limits. Browser hints and API validation consume these exports; server HTTP body caps remain in the API.
- [ui](../../packages/ui/package.json) owns reusable React presentation and its public exports and stories.
- [theme](../../packages/theme/package.json) owns shared CSS tokens.

Keep page-only content, fetching, auth, and navigation in `apps/web`; keep server operations and database queries in `apps/api`. Share code when actual consumers need the same stable responsibility. Similar lines alone do not justify a package or generic framework.

For a new package, establish its consumers, ownership, exports, dependency direction, and verification first. State a routine placement choice and continue within the authorized task; ask only when the decision changes scope or a material requirement. Existing authorization does not need a second permission request solely because code is shared. Follow the [packages](../packages/SKILL.md) and [limits](../limits/SKILL.md) guidance for their respective owners.
