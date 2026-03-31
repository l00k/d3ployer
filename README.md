# d3ployer

A TypeScript-based SSH deployment CLI tool. Run tasks and scenarios against remote servers over SSH, with rsync for file transfer.

## Install

```bash
npm install d3ployer
```

This exposes the `dpl` CLI command.

## Quick start

Create a `deployer.config.ts` in your project root:

```ts
import { defineConfig } from 'd3ployer';

export default defineConfig({
  servers: {
    prod: {
      host: '192.168.1.10',
      deployPath: '/opt/myapp',
    },
  },
  files: {
    basePath: './dist',
    exclude: ['node_modules', '.git'],
  },
  symlinks: [
    { path: 'config.json', target: '/etc/myapp/config.json' },
  ],
  tasks: {
    restart: async (ctx) => {
      await ctx.run('systemctl restart myapp');
    },
  },
  scenarios: {
    deploy: ['upload', 'symlinks', 'dep:install', 'restart'],
  },
});
```

Then deploy:

```bash
dpl deploy           # run "deploy" scenario on all servers
dpl deploy prod      # run on specific server(s)
dpl upload           # run a single task
dpl list             # list available scenarios, tasks, and servers
```

## CLI

```
dpl <name> [servers...]    Run a scenario or task
dpl list                   List scenarios, tasks, and servers

Options:
  -c, --config <path>      Path to deployer.config.ts
```

If `<name>` matches a scenario, it runs all tasks in that scenario sequentially. Otherwise it runs the matching task directly.

## Config

### `servers`

Define target servers. Only `host` and `deployPath` are required.

| Field           | Default              | Description                              |
| --------------- | -------------------- | ---------------------------------------- |
| `host`          | (required)           | Server hostname or IP                    |
| `deployPath`    | (required)           | Remote path to deploy to                 |
| `port`          | `22`                 | SSH port                                 |
| `username`      | Current OS user      | SSH username                             |
| `authMethod`    | `'agent'`            | `'agent'`, `'key'`, or `'password'`      |
| `privateKey`    | -                    | Path to private key (for `'key'`)        |
| `password`      | -                    | SSH password (for `'password'`)          |
| `agent`         | `SSH_AUTH_SOCK`      | SSH agent socket path                    |
| `packageManager`| -                    | Override package manager config per server (or `false` to disable) |
| `initCmd`       | -                    | Shell command to run before each remote command (e.g. `source ~/.nvm/nvm.sh`) |

### `files`

Configure rsync file upload.

```ts
files: {
  basePath: './dist',       // local directory to sync (default: '.')
  include: ['src/**'],      // rsync include patterns
  exclude: ['node_modules'],// rsync exclude patterns
}
```

### `symlinks`

Create symlinks on the remote server.

```ts
symlinks: [
  { path: 'config.json', target: '/etc/myapp/config.json' },
]
```

Relative paths are resolved against `deployPath`.

### `packageManager`

Configure dependency installation. Can be set globally and/or per server. Set to `false` to disable.

```ts
packageManager: {
  manager: 'npm',       // 'npm' | 'yarn' | 'pnpm' (default: 'npm')
  productionOnly: true, // install production deps only (default: true)
}
```

### `pm2`

Set to `false` to disable the built-in PM2 task. When enabled (default), the `pm2:setup` task auto-detects `pm2.config.*` files and runs `pm2 start`.

### `dockerCompose`

Set to `false` to disable the built-in Docker Compose task. When enabled (default), the `docker:setup` task auto-detects compose files and runs `docker compose up -d --build`.

### `logs`

Configure post-deploy log streaming. The `stream:logs` task will stream PM2 or Docker Compose logs for the configured duration. Set to `false` to disable.

```ts
logs: {
  time: 5, // seconds to stream logs (default: 3)
}
```

### `tasks`

Custom task functions receive a `TaskContext` and `Placeholders`:

```ts
tasks: {
  migrate: async (ctx, ph) => {
    await ctx.run('npm run migrate');
  },
}
```

Tasks can also be defined as objects with skip logic and config:

```ts
tasks: {
  myTask: {
    name: 'My Task',
    skip: async (ctx) => !someCondition ? 'Reason to skip' : false,
    task: async (ctx, ph) => { /* ... */ },
    config: { /* passed as ctx.taskConfig */ },
  },
}
```

Task keys are auto-converted from camelCase to colon:case (e.g. `depInstall` becomes `dep:install`).

**TaskContext** provides:
- `run(cmd, options?)` - execute a command on the remote server (auto cd's to `deployPath`)
- `test(cmd)` - execute a command on the remote server, returns `boolean`
- `runLocal(cmd, options?)` - execute a command locally
- `testLocal(cmd)` - execute a command locally, returns `boolean`
- `server` - current server config (includes `name`)
- `ssh` - SSH2Promise connection
- `config` - full deployer config
- `taskConfig` - per-task config from task definition

**RunOptions** (for `run` and `runLocal`):
- `printOutput` - print stdout/stderr (default: `true`)
- `ignoreError` - don't throw on non-zero exit (default: `false`)

**Placeholders** provide:
- `serverName` - name of the current server
- `deployPath` - remote deploy path
- `timestamp` - ISO timestamp (safe for filenames)

### `scenarios`

Named sequences of tasks:

```ts
scenarios: {
  deploy: ['upload', 'symlinks', 'dep:install', 'restart'],
}
```

Or as objects with a custom name:

```ts
scenarios: {
  deploy: {
    name: 'Deploy',
    tasks: ['upload', 'symlinks', 'dep:install', 'restart'],
  },
}
```

## Built-in tasks

| Task               | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `upload`           | Rsync files to the remote server                         |
| `download`         | Rsync files from the remote server (uses task config)    |
| `symlinks`         | Create configured symlinks on the remote server          |
| `dep:install`      | Install dependencies via npm/yarn/pnpm                   |
| `pm2:setup`        | Start/restart PM2 processes (auto-detects pm2.config.*)  |
| `docker:setup`     | Run docker compose up (auto-detects compose files)       |
| `clear:target`     | Remove the entire deploy path (with confirmation prompt) |
| `print:deployment` | Print deployment info (date, files, disk usage)          |
| `stream:logs`      | Stream PM2/Docker Compose logs for a few seconds         |

### Default `deploy` scenario

The built-in `deploy` scenario runs: `upload` → `symlinks` → `dep:install` → `pm2:setup` → `docker:setup` → `print:deployment` → `stream:logs`

Tasks with skip conditions will be automatically skipped when not applicable (e.g. `pm2:setup` skips if no PM2 config file exists).

## Requirements

- Node.js (ESM)
- `rsync` installed locally (for the `upload`/`download` tasks)
- SSH access to target servers

## License

MIT
