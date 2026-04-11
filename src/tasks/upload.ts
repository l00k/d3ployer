import chalk from 'chalk';
import path from 'node:path';
import type { FilesConfig , FilesConfigBase, Placeholders, TaskContext, TaskFn, TaskSkipFn } from '../def.js';
import { buildRsyncCommand } from './helpers/rsync.js';


export const uploadSkip : TaskSkipFn = (ctx : TaskContext) => {
    const files = ctx.config.files;
    return !files
        ? 'No files configuration defined'
        : false
        ;
};

export const uploadTask : TaskFn<FilesConfig> = async(
    ctx : TaskContext<FilesConfig>,
    ph : Placeholders,
) => {
    const configSource = ctx.taskConfig ?? ctx.config.files;
    
    const filesArray : FilesConfigBase[] = configSource instanceof Array
        ? configSource
        : [ configSource ]
    ;
    
    for (const filesEntry of filesArray) {
        const localBase = filesEntry.localPath?.startsWith('/')
            ? filesEntry.localPath
            : path.resolve(ctx.config.rootDir, filesEntry.localPath ?? '.')
        ;
        const remotePath = filesEntry.remotePath?.startsWith('/')
            ? filesEntry.remotePath
            : path.join(ctx.server.deployPath, filesEntry.remotePath ?? '.')
        ;
        
        const dest = `${ctx.server.username}@${ctx.server.host}:${remotePath}`;
        const source = localBase.endsWith('/') ? localBase : localBase + '/';
        
        await ctx.run(`mkdir -p ${remotePath}`);
        
        const command = buildRsyncCommand(
            ctx.server,
            source,
            dest,
            filesEntry,
            {
                delete: true,
                ...filesEntry.rsync,
            },
        );
        console.log(chalk.grey(command));
        
        await ctx.runLocal(command);
    }
};
