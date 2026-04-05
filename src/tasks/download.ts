import chalk from 'chalk';
import path from 'node:path';
import type { FilesConfig, Placeholders, TaskContext, TaskFn, TaskSkipFn } from '../def.js';
import { Exception } from '../utils/index.js';
import { buildRsyncCommand } from './helpers/rsync.js';


export const downloadSkip : TaskSkipFn = (ctx : TaskContext) => {
    const files : FilesConfig | undefined = ctx.taskConfig;
    return !files
        ? 'No files configuration provided in task config'
        : false
        ;
};

export const downloadTask : TaskFn = async(ctx : TaskContext, ph : Placeholders) => {
    const files : FilesConfig = ctx.taskConfig!;
    if (!files) {
        throw new Exception(
            'No files configuration provided in task config',
            1784523741234,
        );
    }
    
    const localBase = files.basePath?.startsWith('/')
        ? files.basePath
        : path.resolve(ctx.config.rootDir, files.basePath ?? '.');
    const remotePath = ph.deployPath;
    const source = `${ctx.server.username}@${ctx.server.host}:${remotePath}/`;
    const dest = localBase.endsWith('/') ? localBase : localBase + '/';
    
    const command = buildRsyncCommand(
        ctx.server,
        source,
        dest,
        files,
        {
            delete: false,
        },
    );
    console.log(chalk.grey(command));
    
    await ctx.runLocal(command);
};
