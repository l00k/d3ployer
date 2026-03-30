import chalk from 'chalk';
import path from 'node:path';
import type {
    FilesConfig,
    PackageManagerConfig,
    Placeholders,
    ScenarioDef,
    ServerConfig,
    TaskContext,
    TaskDef,
    TaskFn,
    TaskSkipFn,
} from './def.js';
import { Exception } from './utils/index.js';


export function buildRsyncCommand (
    server : ServerConfig,
    source : string,
    dest : string,
    files : FilesConfig,
) : string
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
    if (files.exclude) {
        for (const pattern of files.exclude) {
            args.push(`--exclude=${pattern}`);
        }
    }
    if (files.include) {
        for (const pattern of files.include) {
            args.push(`--include=${pattern}`);
        }
        args.push('--exclude=*');
    }
    
    args.push(source, dest);
    return args.join(' ');
}


const uploadSkip : TaskSkipFn = (ctx : TaskContext) => {
    const files = ctx.config.files;
    return !files
        ? 'No files configuration defined'
        : false
        ;
};

const uploadTask : TaskFn = async(ctx : TaskContext, ph : Placeholders) => {
    const files = ctx.config.files!;

    const localBase = files.basePath?.startsWith('/')
        ? files.basePath
        : path.resolve(ctx.config.rootDir, files.basePath ?? '.');
    const remotePath = ph.deployPath;
    const dest = `${ctx.server.username}@${ctx.server.host}:${remotePath}`;
    const source = localBase.endsWith('/') ? localBase : localBase + '/';

    await ctx.run(`mkdir -p ${remotePath}`);

    const command = buildRsyncCommand(ctx.server, source, dest, files);
    console.log(command);

    await ctx.runLocal(command);
};


const symlinksSkip : TaskSkipFn = (ctx : TaskContext) => {
    const symlinks = ctx.config.symlinks;
    return !symlinks || symlinks.length === 0
        ? 'No symlinks defined in config'
        : false
        ;
};

const symlinksTask : TaskFn = async(ctx : TaskContext, ph : Placeholders) => {
    const symlinks = ctx.config.symlinks!;

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


const depInstallSkip : TaskSkipFn = (ctx : TaskContext) => {
    if (ctx.server.packageManager !== undefined) {
        return ctx.server.packageManager === false
            ? 'Package manager disabled for server'
            : false
            ;
    }
    if (ctx.config.packageManager !== undefined) {
        return ctx.config.packageManager === false
            ? 'Package manager disabled in config'
            : false
            ;
    }
    return false;
};

const depInstallTask : TaskFn = async(ctx : TaskContext) => {
    const config : PackageManagerConfig = {
        manager: 'npm',
        productionOnly: true,
        ...ctx.config.packageManager,
        ...ctx.server.packageManager,
    };
    
    let cmd = `${config.manager} install`;
    
    if (config.productionOnly) {
        if (config.manager === 'npm') {
            cmd += ' --omit=dev';
        }
        else if (config.manager === 'yarn') {
            cmd += ' --production';
        }
        else if (config.manager === 'pnpm') {
            cmd += ' --prod';
        }
        else {
            throw new Exception(
                `Unsupported package manager "${config.manager}"`,
                1774823752134,
            );
        }
    }
    
    await ctx.run(cmd);
};


const pm2SetupSkip : TaskSkipFn = async(ctx : TaskContext) => {
    if (ctx.config.pm2 === false) {
        return 'PM2 disabled';
    }
    const pm2ConfigExists = await ctx.test('test -f pm2.config.*');
    if (!pm2ConfigExists) {
        return 'PM2 config not found';
    }
    return false;
};

const pm2SetupTask : TaskFn = async(ctx : TaskContext) => {
    await ctx.run('pm2 start pm2.config.* --update-env');
    await ctx.run('pm2 save');
};


const dockerComposeSetupSkip : TaskSkipFn = async(ctx : TaskContext) => {
    if (ctx.config.dockerCompose === false) {
        return 'Docker Compose disabled';
    }
    const composeExists = await ctx.test('test -f docker-compose.yml -o -f docker-compose.yaml -o -f compose.yml -o -f compose.yaml');
    if (!composeExists) {
        return 'Docker Compose config not found';
    }
    return false;
};

const dockerComposeSetupTask : TaskFn = async(ctx : TaskContext) => {
    await ctx.run('docker compose up -d --build --remove-orphans');
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


export const defaultTasks : Record<string, TaskDef> = {
    upload: {
        name: 'Upload files',
        skip: uploadSkip,
        fn: uploadTask,
    },
    symlinks: {
        name: 'Create symlinks',
        skip: symlinksSkip,
        fn: symlinksTask,
    },
    depInstall: {
        name: 'Install dependencies',
        skip: depInstallSkip,
        fn: depInstallTask,
    },
    pm2Setup: {
        name: 'PM2 setup',
        skip: pm2SetupSkip,
        fn: pm2SetupTask,
    },
    dockerComposeSetup: {
        name: 'Docker Compose setup',
        skip: dockerComposeSetupSkip,
        fn: dockerComposeSetupTask,
    },
    printDeployment: {
        name: 'Print deployment info',
        fn: printDeploymentTask,
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
            'dockerComposeSetup',
            'printDeployment',
        ],
    },
};
