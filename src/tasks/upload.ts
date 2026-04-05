import chalk from 'chalk';
import path from 'node:path';
import type {
    FilesConfig,
    Placeholders,
    ServerConfig,
    TaskContext,
    TaskFn,
    TaskSkipFn,
} from '../def.js';


export type RsyncOptions = {
    delete? : boolean;
}

export function buildRsyncCommand (
    server : ServerConfig,
    source : string,
    dest : string,
    files : FilesConfig,
    options : RsyncOptions = {},
) : string
{
    const {
        delete: useDelete = true,
    } = options;

    const args : string[] = [ 'rsync', '-avz', '--progress=info2' ];

    if (useDelete) {
        args.push('--delete');
    }

    // ssh shell
    const sshParts = [ 'ssh' ];
    if (server.port && server.port !== 22) {
        sshParts.push(`-p ${server.port}`);
    }
    if (server.authMethod === 'key' && server.privateKey) {
        sshParts.push(`-i ${server.privateKey}`);
    }
    sshParts.push('-o StrictHostKeyChecking=no');
    args.push('-e', `"${sshParts.join(' ')}"`);

    // include/exclude
    if (files.exclude) {
        for (const pattern of files.exclude) {
            args.push(`--exclude="${pattern}"`);
        }
    }
    if (files.include) {
        for (const pattern of files.include) {
            args.push(`--include="${pattern}"`);
        }
        args.push('--exclude="*"');
    }

    args.push(source, dest);
    return args.join(' ');
}


export const uploadSkip : TaskSkipFn = (ctx : TaskContext) => {
    const files = ctx.config.files;
    return !files
        ? 'No files configuration defined'
        : false
        ;
};

export const uploadTask : TaskFn = async(ctx : TaskContext, ph : Placeholders) => {
    const files = ctx.config.files!;

    const localBase = files.basePath?.startsWith('/')
        ? files.basePath
        : path.resolve(ctx.config.rootDir, files.basePath ?? '.');
    const remotePath = ph.deployPath;
    const dest = `${ctx.server.username}@${ctx.server.host}:${remotePath}`;
    const source = localBase.endsWith('/') ? localBase : localBase + '/';

    await ctx.run(`mkdir -p ${remotePath}`);

    const command = buildRsyncCommand(
        ctx.server,
        source,
        dest,
        files,
        {
            delete: true,
        },
    );
    console.log(chalk.grey(command));

    await ctx.runLocal(command);
};
