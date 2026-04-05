import type { TaskContext, TaskFn, TaskSkipFn } from '../def.js';
import { buildDockerComposeTestCmd } from './helpers/docker.js';


export const setupDockerSkip : TaskSkipFn = async(ctx : TaskContext) => {
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

export const setupDockerTask : TaskFn = async(ctx : TaskContext) => {
    if (ctx.config.dockerCompose === false) {
        return;
    }
    
    const configFiles = ctx.config.dockerCompose?.configFiles ?? [];
    const options = configFiles.map(f => `-f ${f}`).join(' ');
    
    await ctx.run(`docker compose ${options} down --remove-orphans`);
    await ctx.run(`docker compose ${options} up -d --build`);
};
