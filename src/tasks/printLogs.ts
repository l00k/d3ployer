import chalk from 'chalk';
import type { LogsConfig, TaskContext, TaskFn, TaskSkipFn } from '../def.js';
import { buildDockerComposeTestCmd } from './helpers/docker.js';


export const printLogsPm2Skip : TaskSkipFn = async(ctx : TaskContext) => {
    if (
        ctx.config.pm2 === false
        || ctx.config.pm2.logs === false
    ) {
        return 'Logs disabled';
    }
    
    const hasPm2 = await ctx.test('test -f pm2.config.*');
    if (!hasPm2) {
        return 'No PM2 detected';
    }
    
    return false;
};

export const printLogsDockerSkip : TaskSkipFn = async(ctx : TaskContext) => {
    if (
        ctx.config.dockerCompose === false
        || ctx.config.dockerCompose.logs === false
    ) {
        return 'Logs disabled';
    }
    
    const testCmd = buildDockerComposeTestCmd(ctx.config.dockerCompose);
    const hasDocker = await ctx.test(testCmd);
    
    if (!hasDocker) {
        return 'No Docker Compose detected';
    }
    
    return false;
};


export const printLogsPm2Task : TaskFn = async(ctx : TaskContext) => {
    if (
        ctx.config.pm2 === false
        || ctx.config.pm2.logs === false
    ) {
        return;
    }
    
    const logsConfig : LogsConfig = {
        time: 3,
        lines: 25,
        ...ctx.config.pm2.logs,
    };
    
    const hasPm2 = await ctx.test('test -f pm2.config.*');
    if (hasPm2) {
        const pm2ConfigRaw = await ctx.run('cat pm2.config.*', { printOutput: false });
        const nameMatch = pm2ConfigRaw.stdout.match(/name: ['"](?<name>.+?)['"]/);
        
        const name = nameMatch.groups?.name ?? 'all';
        
        console.log(chalk.cyan(`Streaming PM2 logs for ${logsConfig.time}s...`));
        await ctx.run(
            `timeout ${logsConfig.time} pm2 logs --lines=${logsConfig.lines} "${name}" || true`,
            {
                printOutput: true,
                ignoreError: true,
            },
        );
    }
};

export const printLogsDockerTask : TaskFn = async(ctx : TaskContext) => {
    if (
        ctx.config.dockerCompose === false
        || ctx.config.dockerCompose.logs === false
    ) {
        return;
    }
    
    const logsConfig : LogsConfig = {
        time: 3,
        lines: 25,
        ...ctx.config.dockerCompose.logs,
    };
    
    const testCmd = buildDockerComposeTestCmd(ctx.config.dockerCompose);
    const hasDocker = await ctx.test(testCmd);
    
    if (hasDocker) {
        const configFiles = ctx.config.dockerCompose.configFiles ?? [];
        const options = configFiles.map(f => `-f ${f}`).join(' ');
        
        console.log(chalk.cyan(`Streaming Docker Compose logs for ${logsConfig.time}s...`));
        await ctx.run(
            `timeout ${logsConfig.time} docker compose ${options} logs --tail=${logsConfig.lines} -f || true`,
            {
                printOutput: true,
                ignoreError: true,
            },
        );
    }
};
