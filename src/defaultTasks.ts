import { Exception } from './utils/index.js';
import chalk from 'chalk';
import path from 'node:path';
import type { Placeholders, ScenarioDef, ServerConfig, TaskContext, TaskDef, TaskFn } from './def.js';


function buildRsyncCommand (server : ServerConfig, source : string, dest : string, files : NonNullable<TaskContext['config']['files']>) : string
{
    const args : string[] = [ 'rsync', '-avz', '--delete', '--progress=info2' ];
    
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
    if (files.include) {
        for (const pattern of files.include) {
            args.push(`--include=${pattern}`);
        }
        args.push('--exclude=*');
    }
    if (files.exclude) {
        for (const pattern of files.exclude) {
            args.push(`--exclude=${pattern}`);
        }
    }
    
    args.push(source, dest);
    return args.join(' ');
}


const uploadTask : TaskFn = async(ctx : TaskContext, ph : Placeholders) => {
    const files = ctx.config.files;
    if (!files) {
        return;
    }
    
    const localBase = files.basePath?.startsWith('/')
        ? files.basePath
        : path.resolve(ctx.config.rootDir, files.basePath ?? '.');
    const remotePath = ph.deployPath;
    const dest = `${ctx.server.username}@${ctx.server.host}:${remotePath}`;
    const source = localBase.endsWith('/') ? localBase : localBase + '/';
    
    await ctx.run(`mkdir -p ${remotePath}`);
    
    const command = buildRsyncCommand(ctx.server, source, dest, files);
    await ctx.runLocal(command);
};

const symlinksTask : TaskFn = async(ctx : TaskContext, ph : Placeholders) => {
    const symlinks = ctx.config.symlinks;
    if (!symlinks || symlinks.length === 0) {
        return;
    }
    
    for (const link of symlinks) {
        const target = link.target.startsWith('/')
            ? link.target
            : `${ph.deployPath}/${link.target}`;
        const path = link.path.startsWith('/')
            ? link.path
            : `${ph.deployPath}/${link.path}`;
        
        await ctx.run(`ln -sfn ${target} ${path}`);
    }
};

const depInstallTask : TaskFn = async(ctx : TaskContext) => {
    const pm = ctx.server.packageManager ?? ctx.config.packageManager ?? 'npm';
    
    let cmd = `${pm}`;
    if (pm === 'npm') {
        cmd += ' install --production';
    }
    else if (pm === 'yarn') {
        cmd += ' install --production';
    }
    else if (pm === 'pnpm') {
        cmd += ' install --prod';
    }
    else {
        throw new Exception(
            `Unsupported package manager "${pm}"`,
            1774823752134,
        );
    }
    await ctx.run(cmd);
};

const printDeploymentTask : TaskFn = async(ctx : TaskContext, ph : Placeholders) => {
    await ctx.run('date');

    console.log(
        chalk.cyan('Deployment directory'),
        ph.deployPath,
    );
    await ctx.run('ls -la .');
    
    console.log(chalk.cyan('Directory size'));
    await ctx.run('du -hd 1 .');
};

const pm2SetupTask : TaskFn = async(ctx : TaskContext) => {
    const pm2ConfigExists = await ctx.test('test -f pm2.config.*');
    if (!pm2ConfigExists) {
        console.log(chalk.yellow('PM2 config not found, skipping setup'));
        return;
    }
    
    await ctx.run('pm2 start pm2.config.* --update-env');
    await ctx.run('pm2 save');
};

export const defaultTasks : Record<string, TaskDef> = {
    upload: {
        name: 'Upload files',
        fn: uploadTask,
    },
    symlinks: {
        name: 'Create symlinks',
        fn: symlinksTask,
    },
    depInstall: {
        name: 'Install dependencies',
        fn: depInstallTask,
    },
    printDeployment: {
        name: 'Print deployment info',
        fn: printDeploymentTask,
    },
    pm2Setup: {
        name: 'PM2 setup',
        fn: pm2SetupTask,
    },
};

export const defaultScenarios : Record<string, ScenarioDef> = {
    deploy: {
        name: 'Deploy',
        tasks: [
            'upload',
            'symlinks',
            'depInstall',
            'pm2Setup',
            'printDeployment',
        ],
    },
};
