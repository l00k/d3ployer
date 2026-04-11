import chalk from 'chalk';
import path from 'node:path';
import type { FilesConfig, FilesConfigBase, Placeholders, TaskContext, TaskFn, TaskSkipFn } from '../def.js';
import { Exception } from '../utils/index.js';
import { buildRsyncCommand } from './helpers/rsync.js';


export const downloadSkip : TaskSkipFn = (ctx : TaskContext) => {
    const files : FilesConfig | undefined = ctx.taskConfig;
    return !files
        ? 'No files configuration provided in task config'
        : false
        ;
};

export const downloadTask : TaskFn<FilesConfig> = async(
    ctx : TaskContext<FilesConfig>,
    ph : Placeholders,
) => {
    if (!ctx.taskConfig) {
        throw new Exception(
            'No files configuration provided in task config',
            1784523741234,
        );
    }
    
    const filesArray : FilesConfigBase[] = ctx.taskConfig instanceof Array
        ? ctx.taskConfig
        : [ ctx.taskConfig ]
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
        
        const source = `${ctx.server.username}@${ctx.server.host}:${remotePath}/`;
        const dest = localBase.endsWith('/') ? localBase : localBase + '/';
        
        const command = buildRsyncCommand(
            ctx.server,
            source,
            dest,
            filesEntry,
            {
                delete: false,
                ...filesEntry.rsync,
            },
        );
        console.log(chalk.grey(command));
        
        await ctx.runLocal(command);
    }
};
