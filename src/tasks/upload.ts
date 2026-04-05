import chalk from 'chalk';
import path from 'node:path';
import type { Placeholders, TaskContext, TaskFn, TaskSkipFn } from '../def.js';
import { buildRsyncCommand } from './helpers/rsync.js';


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
