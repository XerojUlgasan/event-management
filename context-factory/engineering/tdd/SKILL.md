---
name: tdd
description: "Demonstrate failing-before and passing-after behavior when a practical regression path exists."
---

# TDD bug fix

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Use when explicitly asked for TDD/regression proof or when a bug has an obvious cheap local test target. Do not create an expensive framework, brittle mocks, timing-sensitive checks, or broad fixture churn to satisfy a ceremony.

1. Establish intended behavior, current failure, and smallest observable reproduction.
2. Choose the narrowest useful existing test or executable check. API behavior suites use node:test through tsx in apps/api/tests; read their database/emulator/storage setup before running.
3. Add the focused regression and run it before changing implementation. It must fail for the intended behavior, not missing setup or an unrelated error.
4. Make the smallest root-cause fix while preserving other contracts.
5. Rerun the regression and the relevant nearby verification. Keep tests tied to observable results under [test behavior](../principle-test-behavior-not-implementation/SKILL.md).

If a test is impractical, use a targeted script, route reproduction, browser action, or other check that can expose the bug. Do not weaken valid assertions to match wrong behavior. State when failing-before evidence was unavailable.

See [API verification](../../api/reference/verification.md), [frontend verification](../../frontend/reference/styling-and-verification.md), and [QA](../../QA/SKILL.md) for actual local tools. There is no assumed Vitest or Playwright suite here. Report the failing-before signal, passing-after result, nearby checks, and boundaries actually exercised.
