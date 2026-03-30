# d3ployer

A TypeScript-based SSH deployment CLI tool. Runs tasks/scenarios against remote servers over SSH using rsync for file transfer.

**Why:** Provides a reusable, config-driven deployment pipeline for home-lab or similar server setups.

## Key source files

- `src/bin.ts` — shebang entry point (package.json `bin` exposes as `dpl`)
- `src/cli.ts` — Commander CLI: `deployer <name> [servers...]`, `deployer list`, supports `-c, --config <path>`
- `src/config.ts` — `defineConfig()` helper, applies server defaults, merges defaultTasks, converts camelCase task/scenario keys to colon:case
- `src/configLoader.ts` — walks up directory tree to find `deployer.config.ts`, dynamic-imports it
- `src/connection.ts` — `createSSHConnection()` using ssh2-promise; supports key/password/agent auth
- `src/defaultTasks.ts` — built-in tasks: `upload`, `download`, `symlinks`, `depInstall`, `pm2Setup`, `dockerSetup`, `clearTarget`, `printDeployment`
- `src/def.ts` — all TypeScript types/interfaces (ServerConfig, TaskFn, TaskContext, DeployerConfig, etc.)
- `src/runner.ts` — `runScenario()` and `runTask()` using Listr2; connects SSH per server, runs tasks sequentially
- `src/index.ts` — public API re-exports
- `src/utils/Exception.ts` — custom Exception class with error code, reason chain, and stack rewriting
- `src/utils/index.ts` — barrel export for utils

## Core flow

1. CLI parses `<name> [servers...]`
2. `loadConfig()` finds and imports `deployer.config.ts`
3. If name matches a scenario key → `runScenario()`, else → `runTask()`
4. For each server: SSH connect → run task fns in order → SSH disconnect (via Listr2)

## Config structure (`deployer.config.ts`)

```ts
defineConfig({
  servers: { prod: { host, deployPath, packageManager?, initCmd?, ... } },
  files: { basePath, include, exclude },
  symlinks: [{ path, target }],
  packageManager: { manager: 'npm' | 'yarn' | 'pnpm', productionOnly: true },
  pm2: true,
  dockerCompose: true,
  tasks: { myTask: async (ctx, ph) => { ... } },
  scenarios: { deploy: ['upload', 'symlinks', 'myTask'] },
})
```

## Task naming convention

Task keys are converted from camelCase to colon:case via `camelToColonCase()`. E.g. `depInstall` → `dep:install`, `pm2Setup` → `pm2:setup`.

## Built-in tasks

- `upload` — rsync files to remote (skips if no `files` config)
- `download` — rsync files from remote (uses `taskConfig` for files config)
- `symlinks` — create symlinks on remote (skips if no `symlinks` config)
- `dep:install` — run package manager install (npm/yarn/pnpm, respects `packageManager` config at global and per-server level)
- `pm2:setup` — start PM2 processes if pm2.config.* exists (skips if `pm2: false` or no config file)
- `docker:setup` — run docker compose up if compose file exists (skips if `dockerCompose: false` or no compose file)
- `clear:target` — rm -rf deployPath (with interactive confirmation via @inquirer/confirm)
- `print:deployment` — show date, directory listing, and disk usage

## Default scenario

`deploy` runs: `upload` → `symlinks` → `dep:install` → `pm2:setup` → `docker:setup` → `print:deployment`

## Server defaults

- port: 22
- username: current OS user
- authMethod: 'agent' (uses SSH_AUTH_SOCK)

## TaskContext helpers

Available in TaskFn via `ctx`:
- `run(cmd, options?)` — execute command on remote server via SSH (cd's to deployPath, runs initCmd if set)
- `test(cmd)` — execute command on remote, returns boolean success
- `runLocal(cmd, options?)` — execute command locally via shell
- `testLocal(cmd)` — execute command locally, returns boolean success
- `server` — current server config (with `name`)
- `ssh` — SSH2Promise connection
- `config` — full deployer config
- `taskConfig` — per-task config from TaskDef.config

## RunOptions

`{ printOutput?: boolean, ignoreError?: boolean }` — available for `run()` and `runLocal()`

## Task skip & config

Tasks can define a `skip` function (`TaskSkipFn`) returning `false` (run), `true` (skip), or a `string` (skip reason). Tasks can also carry a `config` property accessible via `ctx.taskConfig`.

## Placeholders

Available in TaskFn via `ph`: `serverName`, `deployPath`, `timestamp` (ISO, colons/dots replaced with dashes)

## Tech stack

- Runtime: Node (ESM, tsx for dev)
- CLI: commander
- SSH: ssh2-promise
- File sync: rsync (system rsync invoked via shell)
- Task UI: listr2
- Interactive prompts: @inquirer/confirm
- Utilities: lodash-es, chalk
- Build: tsc (tsconfig.build.json)
- Test: mocha + chai (c8 coverage)
- Lint: eslint + typescript-eslint + lint-staged + husky
