---
name: principle-test-behavior-not-implementation
description: "Assert observable contracts and effects without pinning private helpers or copying the implementation."
---

# Test behavior, not implementation

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Drive the public interface with concrete input and derive the expected result from the requirement. Observe return values, status/errors, cookies, persisted state, user-visible outcomes, or requests sent to an external boundary.

Check two counterexamples: would the test fail if the result were wrong or a required effect were skipped/duplicated? Would it survive a refactor with identical observable behavior? If not, improve or remove the test.

Use mocks for a focused boundary, not as proof that the real integration works. API suites here use node:test via tsx and disposable PostgreSQL; inspect setup before running them. Schema/type invariants can be meaningful tests, while assertions that restate an unused constant or private helper order are not. Do not add low-value tests for a reversible prose or style edit.
