import confirm from '@inquirer/confirm';
import chalk from 'chalk';
import path from 'node:path';
import type {
    DockerComposeConfig,
    FilesConfig,
    LogsConfig,
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


function buildDockerComposeTestCmd (dockerComposeConfig : DockerComposeConfig | false) : string
{
    if (dockerComposeConfig === false) {
        return 'false';
    }
    
    const configFiles = dockerComposeConfig.configFiles ?? [
        'docker-compose.yml',
        'docker-compose.yaml',
        'compose.yml',
        'compose.yaml',
    ];
    const testCmdPart = configFiles.map(f => `-f ${f}`);
    
    return `test ${testCmdPart.join(' -o ')}`;
}

const dockerSetupSkip : TaskSkipFn = async(ctx : TaskContext) => {
    if (ctx.config.dockerCompose === false) {
        return 'Docker Compose disabled';
    }
    
    const testCmd = buildDockerComposeTestCmd(ctx.config.dockerCompose);
    const composeExists = await ctx.test(testCmd);
    if (!composeExists) {
        return 'Docker Compose config not found';
    }
    return false;
};

const dockerSetupTask : TaskFn = async(ctx : TaskContext) => {
    if (ctx.config.dockerCompose === false) {
        return;
    }
    
    const configFiles = ctx.config.dockerCompose?.configFiles ?? [];
    const options = configFiles.map(f => `-f ${f}`).join(' ');
    
    await ctx.run(`docker compose ${options} down --remove-orphans`);
    await ctx.run(`docker compose ${options} up -d --build`);
};


const clearTargetTask : TaskFn = async(ctx : TaskContext, ph : Placeholders) => {
    const confirmed = await confirm({
        message: chalk.red(`Remove entire deploy path ${ph.deployPath} on ${ctx.server.host}?`),
        default: false,
    });
    
    if (!confirmed) {
        console.log(chalk.yellow('Skipped clearing target'));
        return;
    }
    
    await ctx.run(`rm -rf ${ph.deployPath}`);
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


const logsStreamSkip : TaskSkipFn = async(ctx : TaskContext) => {
    if (ctx.config.logs === false) {
        return 'Logs streaming disabled';
    }
    
    const hasPm2 = ctx.config.pm2 !== false && await ctx.test('test -f pm2.config.*');
    
    let hasDocker = false;
    
    if (ctx.config.dockerCompose) {
        const testCmd = buildDockerComposeTestCmd(ctx.config.dockerCompose);
        hasDocker = await ctx.test(testCmd);
    }
    
    if (!hasPm2 && !hasDocker) {
        return 'No PM2 or Docker Compose detected';
    }
    
    return false;
};

const logsStreamTask : TaskFn = async(ctx : TaskContext) => {
    const logsConfig : LogsConfig = {
        time: 3,
        ...ctx.config.logs,
    };
    const time = logsConfig.time!;
    
    const hasPm2 = ctx.config.pm2 !== false
        && await ctx.test('test -f pm2.config.*')
    ;
    let hasDocker = false;
    if (ctx.config.dockerCompose !== false) {
        const testCmd = buildDockerComposeTestCmd(ctx.config.dockerCompose);
        hasDocker = await ctx.test(testCmd);
    }
    
    if (hasPm2) {
        const pm2ConfigRaw = await ctx.run('cat pm2.config.*', { printOutput: false });
        const nameMatch = pm2ConfigRaw.stdout.match(/name: ['"](?<name>.+?)['"]/);
        
        const name = nameMatch.groups?.name ?? 'all';
        
        console.log(chalk.cyan(`Streaming PM2 logs for ${time}s...`));
        await ctx.run(`timeout ${time} pm2 logs "${name}" || true`, { printOutput: true, ignoreError: true });
    }
    else if (hasDocker && ctx.config.dockerCompose) {
        const configFiles = ctx.config.dockerCompose.configFiles ?? [];
        const options = configFiles.map(f => `-f ${f}`).join(' ');
        
        console.log(chalk.cyan(`Streaming Docker Compose logs for ${time}s...`));
        await ctx.run(`timeout ${time} docker compose ${options} logs --tail=10 -f || true`, {
            printOutput: true,
            ignoreError: true,
        });
    }
};


export const defaultTasks : Record<string, TaskDef> = {
    clearTarget: {
        name: 'Clear target',
        task: clearTargetTask,
    },
    upload: {
        name: 'Upload files',
        skip: uploadSkip,
        task: uploadTask,
    },
    download: {
        name: 'Download files',
        skip: downloadSkip,
        task: downloadTask,
    },
    symlinks: {
        name: 'Create symlinks',
        skip: symlinksSkip,
        task: symlinksTask,
    },
    depInstall: {
        name: 'Install dependencies',
        skip: depInstallSkip,
        task: depInstallTask,
    },
    pm2Setup: {
        name: 'PM2 setup',
        skip: pm2SetupSkip,
        task: pm2SetupTask,
    },
    dockerSetup: {
        name: 'Docker Compose setup',
        skip: dockerSetupSkip,
        task: dockerSetupTask,
    },
    printDeployment: {
        name: 'Print deployment info',
        task: printDeploymentTask,
    },
    logsStream: {
        name: 'Logs stream',
        skip: logsStreamSkip,
        task: logsStreamTask,
    },
};

export const defaultScenarios : Record<string, ScenarioDef> = {
    deploy: {
        name: 'Deploy',
        tasks: [
            'upload',
            'symlinks',
            'dep:install',
            'pm2:setup',
            'docker:setup',
            'print:deployment',
            'logs:stream',
        ],
    },
};
