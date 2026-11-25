# Test environments in .room

When asked to **create or start a room**, deliver a running test environment with dependencies installed, migrations deployed, and seeded data. Use the room runner below; creating a Git checkout alone is incomplete.

## Names and revisions

Rooms live directly under the primary checkout's `.room/<name>`, with `apps/` and `packages/` directly inside each worktree. Use short lowercase names describing the feature or purpose: `catalog`, `quotes`, `chat-fix`, `pr45`, or `test`. Prefer one or two words in kebab-case; avoid timestamps, random IDs, repeated repository names, and `worktree1`. Preserve existing rooms and worktrees elsewhere.

Inspect `git status --short`, `git rev-parse HEAD`, and `git worktree list` first. From a linked worktree, locate and return to the primary checkout before running the commands below. Choose the requested revision explicitly: new rooms contain committed files at that revision and do not inherit unfinished changes from the primary checkout. Transfer only task-authorized changes when testing unfinished work. Existing rooms retain their current revision and local changes.

## Create, start, and inspect

The runner requires Linux for process ownership checks, plus the [local development prerequisites](development.md#local-development). Run from the primary checkout:

```sh
# Create a detached test checkout at the selected commit or branch, then prepare it.
pnpm room create quotes HEAD

# Prepare and start an existing room, including the original .room/test.
pnpm room start test

pnpm room status test
pnpm room list
```

The runner installs each room's dependencies with the frozen lockfile, starts a uniquely named local Supabase project with a database and Studio, runs the selected revision's `db:deploy` and `db:seed`, then starts its Node API and website. It also starts the background worker when that revision provides the `worker:background-jobs` script; older revisions run without one. It checks actual HTTP readiness and seeded authentication before reporting ready. Preparation errors leave the room unready and identify private logs; resolve the failing step and retry. A running, healthy start is idempotent and does not rerun preparation over active browser sessions.

The room uses the **Node API** against its own Supabase database and configured R2 prefix. Restart the room after API or worker code changes so those foreground processes load the edited source; the website retains Astro development reloads. Unused Realtime, mail, analytics, Supabase Storage, and Edge Runtime are disabled for rooms. Application sign-in still belongs to the Node API, and SQL pgvector remains available. This tests application behavior; it does not prove the Edge Function bundle. Follow [local tools](local-tools.md) and the selected revision's area guidance for additional checks. Read that room's `AGENTS.md` and task router; retain these setup rules from the primary checkout when testing a revision that predates the runner.

## Isolation and configuration

Each room has a persisted allocation of ports and a distinct loopback address for its browser origin. This separates host-bound login and guest cookies, which different ports on the same hostname would share. Use the exact website URL reported by `status`; replacing its host with `localhost` defeats cookie isolation. Its API URLs and allowed origin point to that room. Containers, database volumes, background workers, and process ownership are separate from the primary development stack and other rooms. The R2 object prefix isolates each room’s files.

Runtime manifests, generated configuration, logs, and private environment files live under `.room/.state/<name>/`. The runner leaves checked-in application configuration untouched. Parent Git, formatting, linting, and pnpm workspace sweeps exclude room contents; run feature checks from inside the selected worktree. Record the actual revision, local changes, URLs, migration/seed outcome, and readiness evidence when handing over a room.

Room configuration starts from that revision's environment examples. The runner does not inherit primary database targets or automatically copy provider credentials. Put room-specific settings in `.room/.state/<name>/overrides.env`, then stop/start to load them. Database targets, ports, and origins remain owned by the runner. Keep private values out of chat, tracked files, and verification records. Use the selected revision's [seed guide](../../../../docs/SEED.md) and fixture source for local sign-in; do not repeat passwords in guidance.

Create the room’s private `.room/.state/<name>/overrides.env` before running `pnpm room create`. Include the [R2 media settings](development.md#cloudflare-r2-storage) required for seeding and `R2_OBJECT_PREFIX=test-rooms/<name>/<unique-id>`. Include the R2 document bucket when testing supporting PDFs. Keep the buckets and prefix stable on restart so saved files remain readable. Live AI and embeddings require separate room-specific settings and verification. When the primary checkout has an older runner, launch `pnpm room start <name>` from the room worktree with the updated runner before its first seed. Firebase and other external integrations are outside the room runner. Starting a configured worker can make paid provider calls. Creating a room does not authorize copying production data or changing the primary stack.

## Stop and remove

To stop services while keeping the room available for later testing, run:

```sh
pnpm room stop test
```

Stop terminates only the room's owned application processes and Supabase project and retains the worktree, database, and R2 objects. A later start deploys pending migrations and reruns the existing insert-only seed without resetting the database. Never use a reset to make startup pass or stop unrelated processes to free a room's port.

Before removing a room, inspect `git -C .room/test status --short --untracked-files=all --ignored` and its branch/detached commits. Save or hand off tracked changes, untracked files, ignored local files, detached commits, and test data that must be retained. A clean tracked status alone does not prove the room is disposable. Create a `codex/` branch inside a detached room before retaining new commits.

Rooms created by the runner already use detached HEAD. To remove a room from Git's worktree registrations and delete its checkout, use the following sequence from the primary checkout **after removal is authorized and needed work is saved**:

```sh
pnpm room stop test
git worktree remove .room/test
git worktree list
pnpm room list
```

Stop before removal. The runner requires a registered worktree to stop its services. Use no `--force` and investigate a refusal. These commands retain the database volume, R2 objects, and `.room/.state/test/` (including private configuration and logs). Consequently, `pnpm room list` can still show the retained allocation as `worktree unavailable`. There is currently no `pnpm room remove` or purge command.

Keep branches, retained state, and data volumes unless their deletion is explicitly authorized. Preserve other rooms and `.room/.gitkeep`. Retain unfinished work through [runs](../../../runs/README.md) across sessions.
