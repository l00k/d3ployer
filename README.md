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
      await ctx.runRemote('systemctl restart myapp');
    },
  },
  scenarios: {
    deploy: ['upload', 'symlinks', 'depInstall', 'restart'],
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

| Field           | Default              | Description                          |
| --------------- | -------------------- | ------------------------------------ |
| `host`          | (required)           | Server hostname or IP                |
| `deployPath`    | (required)           | Remote path to deploy to             |
| `port`          | `22`                 | SSH port                             |
| `username`      | Current OS user      | SSH username                         |
| `authMethod`    | `'agent'`            | `'agent'`, `'key'`, or `'password'`  |
| `privateKey`    | -                    | Path to private key (for `'key'`)    |
| `password`      | -                    | SSH password (for `'password'`)      |
| `agent`         | `SSH_AUTH_SOCK`      | SSH agent socket path                |
| `packageManager`| -                    | Override package manager per server  |
| `initCmd`       | -                    | Command to run on connect            |

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

### `tasks`

Custom task functions receive a `TaskContext` and `Placeholders`:

```ts
tasks: {
  migrate: async (ctx, ph) => {
    await ctx.runRemote(`cd ${ph.deployPath} && npm run migrate`);
  },
}
```

**TaskContext** provides:
- `runRemote(cmd)` - execute a command on the remote server
- `runLocal(cmd)` - execute a command locally
- `server` - current server config
- `ssh` - SSH2Promise connection
- `config` - full deployer config

**Placeholders** provide:
- `serverName` - name of the current server
- `deployPath` - remote deploy path
- `timestamp` - ISO timestamp (safe for filenames)

### `scenarios`

Named sequences of tasks:

```ts
scenarios: {
  deploy: ['upload', 'symlinks', 'depInstall', 'restart'],
}
```

## Built-in tasks

| Task         | Description                                    |
| ------------ | ---------------------------------------------- |
| `upload`     | Rsync files to the remote server               |
| `symlinks`   | Create configured symlinks on the remote server |
| `depInstall` | Run package manager install on the remote server|

## Requirements

- Node.js (ESM)
- `rsync` installed locally (for the `upload` task)
- SSH access to target servers

## License

MIT
