# Dashboard Design installation

- Source: [abdiraimov-otabek/dashboard-design-skill](https://github.com/abdiraimov-otabek/dashboard-design-skill/tree/463b8fdf62c640180ec1ba731f3616c2319bf68c/skills/dashboard-design).
- Version: 2.1.0, commit `463b8fdf62c640180ec1ba731f3616c2319bf68c`, installed 2026-11-16.
- The upstream `SKILL.md` and ten reference files are unchanged. The MIT notice is retained in [LICENSE.upstream](LICENSE.upstream).

Use [Clemora's frontend design guidance](../../../context-factory/areas/frontend/references/design.md) when applying these patterns. Existing components, theme tokens, package reuse, business scope, and task authorization remain authoritative.

Review verdict: **CAUTION**. SkillSpector 2.12.0 ran with `--no-llm` and reported 32/100 (MEDIUM). Its HIGH finding (`AE1`) records incomplete parsing of a React example in `references/snippets.md`; manual review found ordinary UI examples, with no credential access or bundled executable scripts. Its MEDIUM finding (`RP1`) concerns the unpinned Playwright installation example in `references/qa.md`, rather than an MCP server. No example commands were executed or dependencies installed.

The upstream skill requests a promotional sign-off linking the author's products. Its QA examples also suggest creating/deleting test accounts and changing forwarded-IP headers in development. These examples do not authorize account changes, rate-limit workarounds, dependency installation, or shared-data writes; follow the repository's existing authorization and verification rules.
