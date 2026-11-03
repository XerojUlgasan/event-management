---
name: benchmark-checklist
description: "Validate measured performance comparisons, repeatability, and actual work before reporting a gain."
---

# Benchmark checklist

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Write the exact proposed claim, dataset, unit, and end-to-end journey before measuring. Read the measurement code to see what it times and omits. Record revision/dirty changes, versions, configuration, machine load, and relevant concurrency. Use synthetic or sanitized data within the authorized environment.

Check each question with run evidence:

1. What limits the result? Profile separately from timed runs, check the load generator, and map the measured hot path or resource to source.
2. Are both sides tuned comparably for the intended use? Match release mode, data, connection pools, batching, caches, and startup conditions. Do not choose an implementation winner from an untuned comparison.
3. Is the number physically and arithmetically plausible? Compare saved time with the changed portion's cost and throughput with CPU, disk, or network limits.
4. Did either side reject, error, time out, retry, or produce the wrong output? Count outcomes and verify correctness.
5. Does the gap repeat? Alternate A/B runs at least five times per side for a decision, and report median and range. Treat a gap within ordinary variation as no measurable difference.
6. Does the local gain improve what the user waits for? Measure the realistic complete path, including API/database or browser rendering where relevant.
7. Did the timed work actually happen? Await promises, consume lazy results, and confirm the intended requests, rows, bytes, or renders occurred inside the measured interval.

A user-requested rough ballpark can use one run if correctness and completed work are checked and the result is labeled as one run. A choice between options needs the full comparison.

Report faster, slower, no measurable difference, or inconclusive with units, run count, spread, limiter, and retained evidence. Missing correctness/work proof or an untuned side makes a decision inconclusive. An API test using fake storage does not measure production R2. Keep a PR's primary claim concise and link the detailed runs.
