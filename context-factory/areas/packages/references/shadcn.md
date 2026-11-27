# shadcn skill integration

The official [shadcn skill](../../../../.agents/skills/shadcn/SKILL.md) is installed for this project in `.agents/skills/shadcn/`, alongside the existing design skills. It supplies component composition rules, CLI references, theming, registry guidance, and design-system examples. The [packages skill](../SKILL.md) routes relevant work here; AMAC's [package reuse workflow](reuse.md) continues to own placement and verification.

## Current setup and prerequisites

Checked on 2026-11-06: [UI exports](../../../../packages/ui/src/index.ts) expose AMAC's custom React components. The [UI manifest](../../../../packages/ui/package.json) exports the root entry and stylesheet. Neither `apps/web` nor `packages/ui` has a `components.json`; installing this skill does not initialize shadcn or migrate those components.

Before implementing shadcn setup:

1. Inspect current app/UI manifests, aliases, exports, styles, theme tokens, stories, and consuming screens. Load the [frontend](../../frontend/SKILL.md) and [packages](../SKILL.md) guidance and their required references.
2. Establish the intended component destinations, public exports, primitive library, icon approach, and mapping to the existing theme. Keep reusable presentation in `packages/ui`, shared tokens in `packages/theme`, and app behavior in `apps/web`.
3. Configure `components.json` in the appropriate workspace locations as part of the authorized setup. Preview generated paths, imports, dependency changes, and CSS changes before applying registry additions.
4. Follow the package and frontend verification requirements after changes, including rendered component states and affected browser journeys.

Use `pnpm dlx shadcn@latest` in place of upstream `npx` examples. The skill's inline project-context command is an upstream example; locate the configured workspace first. Once configuration exists, use the appropriate command from the repository root:

```sh
pnpm dlx shadcn@latest info --json --cwd apps/web
pnpm dlx shadcn@latest info --json --cwd packages/ui
```

Inspect the matching local implementation before applying shadcn APIs: AMAC's current `Button`, `Select`, `Tabs`, `FormField`, and dialogs have different contracts. Apply new-app scaffolding and `add --all` recipes only when the requested work actually calls for a new app or all components. Skill installation alone does not authorize those operations or MCP configuration changes.

The bundled showcase coverage script assumes a flat UI folder and `/ui/<component>` imports. AMAC uses atomic folders and root package exports, so that script is not a coverage check for the current library. Existing Storybook remains the component reference.

## Source and review

- Source: [shadcn-ui/ui, skills/shadcn](https://github.com/shadcn-ui/ui/tree/d549251bab2e57dbf72f7c909d6458c02c43f529/skills/shadcn).
- Pinned revision: `d549251bab2e57dbf72f7c909d6458c02c43f529`, retrieved on 2026-11-06. The upstream skill files are unchanged; the upstream [MIT license](../../../../.agents/skills/shadcn/LICENSE.upstream) is included.
- Static review: SkillSpector ran with `--no-llm`. It returned `100/100`, `CRITICAL`, `DO_NOT_INSTALL`, with 89.5% reported coverage and two files only partly analyzed because of parser limits. This is the scanner result, not the combined verdict.
- Combined verdict: **CAUTION**. Manual review covered the entry point, bundled script and showcase source, all HIGH findings, and the sensitive MEDIUM findings. No unexplained HIGH finding remained. The skill documents network-backed CLI operations that can change project files and dependencies; those operations require the usual source/diff inspection and must fit the user's task.

| Scanner finding | Source review |
| --- | --- |
| `AE1`: incomplete analysis | Read `rules/base-vs-radix.md` and `scripts/showcase-coverage.mjs` in full. The former is API guidance; the latter reads caller-supplied directories, reports import coverage, and has no network or file writes. No bundled target script was executed during installation. |
| `MP3`: memory manipulation | The match is the phrase “preset state” in CLI documentation, not agent-memory modification. |
| `RA1`, `EA2`: overwrite/confirmation flags | These document real project-writing CLI flags. Upstream requires preview/diff review and explicit approval for overwrite operations. They do not modify the installed skill itself. |
| `AS1`: agent configuration access | `mcp.md` lists the Codex configuration location for optional manual MCP setup. Installation did not read or change that configuration. |
| `OH1`: HTML injection | The example inserts a fixed, locally defined scroll-position script. It does not interpolate messages or model output into that script; preserve that boundary if adopting the example. |
| `RP1`: moving CLI version | Upstream examples use `shadcn@latest`, so future CLI execution downloads the then-current release. Pinning the skill snapshot does not pin that executable. |
| `E1`: external endpoint | `cli.md` shows a placeholder registry URL with `--dry-run`; the skill does not execute it or transmit local content during installation. |

Metadata and bundled local-link checks passed. Source identity is verified separately from these structural checks. No application components, dependencies, theme, or shadcn project configuration were changed by installing the skill.
