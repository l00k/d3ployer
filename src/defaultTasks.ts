import chalk from 'chalk';
import { spawn } from 'node:child_process';
import path from 'node:path';
import type { Placeholders, ScenarioDef, ServerConfig, TaskContext, TaskDef, TaskFn } from './def.js';
import { Exception } from './utils/Exception.js';

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

function execRsync (command : string) : Promise<void>
{
    return new Promise((resolve, reject) => {
        const child = spawn('sh', [ '-c', command ], {
            stdio: [ 'inherit', 'pipe', 'pipe' ],
        });
        
        const stderrChunks : string[] = [];
        
        child.stdout.on('data', (data : Buffer) => {
            process.stdout.write(data);
        });
        
        child.stderr.on('data', (data : Buffer) => {
            stderrChunks.push(data.toString());
            process.stderr.write(data);
        });
        
        child.on('close', (code) => {
            if (code !== 0) {
                const details = stderrChunks.length
                    ? `\n${stderrChunks.join('')}`
                    : '';
                reject(
                    new Exception(
                        `rsync exited with code ${code} (cmd: ${command})${details}`,
                        1774741947570,
                    ),
                );
                return;
            }
            resolve();
        });
        
        child.on('error', (err) => {
            reject(
                new Exception(
                    `rsync failed: ${command}\n${err.message}`,
                    1774741947571,
                ),
            );
        });
    });
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
    await execRsync(command);
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

const depInstallTask : TaskFn = async(ctx : TaskContext, ph : Placeholders) => {
    const pm = ctx.server.packageManager ?? ctx.config.packageManager ?? 'npm';
    const cmd = `${pm} install`;
    await ctx.run(cmd);
};

const printDeploymentTask : TaskFn = async(ctx : TaskContext, ph : Placeholders) => {
    console.log(
        chalk.cyan('Deployment directory'),
        ph.deployPath,
    );
    await ctx.run('ls -la .');
    
    console.log(chalk.cyan('Directory size'));
    await ctx.run('du -hd 1 .');
};

const pm2SetupTask : TaskFn = async(ctx : TaskContext, ph : Placeholders) => {
    const pm2ConfigExists = await ctx.test('test -f pm2.config.js');
    if (!pm2ConfigExists) {
        console.log(chalk.yellow('pm2.config.js not found, skipping PM2 setup'));
        return;
    }
    
    await ctx.run('pm2 start pm2.config.js --update-env');
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
        ],
    },
};
