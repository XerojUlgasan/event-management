# Test worktrees in .room

Use `.room/<name>` under the primary checkout for separate Git checkouts you or the user can test. Each folder is the worktree root, with `apps/`, `packages/`, and its own working files directly inside it. Keep existing worktrees elsewhere until a move is explicitly requested.

## Choose a short name

Use one or two lowercase words in kebab-case describing the feature or purpose: `catalog`, `quotes`, `chat-fix`, `pr45`. Use `test` for a general committed baseline. If a name is occupied, reuse it only when it belongs to the same task; otherwise add a meaningful suffix such as `quotes-api`. Avoid timestamps, random IDs, repeated repository names, and vague names such as `worktree1`. Branch names remain separate and use `codex/` for new agent branches.

## Create or select a checkout

1. From the primary checkout, inspect `git status --short`, `git rev-parse HEAD`, and `git worktree list`. From a linked worktree, locate the primary checkout in that list and return there before creating another room. Keep all rooms directly under the primary `.room`; avoid nesting rooms inside rooms.
2. Select the intended branch or commit explicitly. Worktrees contain committed files at that revision; they do **not** inherit uncommitted changes, local environment files, dependencies, or the primary checkout's ignored files. If testing an unfinished change, agree which files or commit belong to the task and transfer only that work; preserve the source checkout.
3. Choose one command below, run from the primary checkout. Replace the sample name, branch, and revision for the task; inspect existing destinations first.

```sh
# A disposable committed snapshot, including when main is already checked out.
git worktree add --detach .room/test HEAD

# An existing local branch that is not checked out elsewhere.
git worktree add .room/quotes codex/quotes

# A new task branch from an explicitly selected starting revision.
git worktree add -b codex/chat-fix .room/chat-fix HEAD
```

Git refuses a branch already checked out in another worktree. Use that checkout or a detached snapshot of its commit instead of forcing it. Never overwrite an occupied folder or reset an existing branch to create a room.

Confirm `git -C .room/test status --short` and `git -C .room/test rev-parse HEAD` (substitute your name), then check `git worktree list`. Report the path, branch or detached commit, and whether task changes are present. A detached room is suitable for testing; create a `codex/` branch there before retaining new commits.

## Prepare and test

- Read the selected worktree's `AGENTS.md` and task router. When testing an older revision that predates this guide, also retain these room setup and cleanup rules from the primary checkout. Record which revision and local changes you actually test.
- Run commands from inside the selected room. Inspect its package scripts, then install dependencies there with `pnpm install --frozen-lockfile` when needed. Keep separate `node_modules` directories so package links and generated files resolve to that checkout.
- Follow [local tools](local-tools.md) and the affected area's verification guidance for the closest relevant checks. Parent checks and workspace filters target the primary checkout; they do not test all rooms. The primary `.room` contents are Git-ignored except for `.gitkeep`, and excluded from its ESLint and Prettier sweeps.
- Configure any required local environment from the selected revision's examples without recording credentials in guidance or test reports. A worktree isolates source files, **not** databases, containers, ports, storage, or background workers. Read [local development](../../../../README.md#local-development), inspect the actual targets and running processes, and choose nonconflicting ports and authorized test data before runtime tests. Confirm the browser/API are serving the intended room and revision.
- Startup can apply migrations, and workers can consume existing jobs or call paid providers. Room creation does not authorize shared data changes or service restarts. Use an explicitly configured disposable target where isolation is needed; changing a folder name alone does not create one.

## Keep or remove

Leave a room available while the user is testing it and report its path and verification limits. Before cleanup, stop only services owned by that room, inspect `git -C .room/test status --short --untracked-files=all --ignored`, and review its branch/detached commits for work that must be retained. Save or hand off changes, untracked files, ignored local files, and detached commits before removal; a clean tracked status alone does not prove the room is disposable.

When cleanup is authorized and the room's work is retained or deliberately disposable, run from the primary checkout:

```sh
git worktree remove .room/test
git worktree list
```

Use Git removal without `--force`; investigate a refusal. Keep task branches unless deleting them is separately authorized. Preserve other agents' rooms and the tracked `.room/.gitkeep`. Retain unfinished task evidence through [runs](../../../runs/README.md) when work spans sessions.
