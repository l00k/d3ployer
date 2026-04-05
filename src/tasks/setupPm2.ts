import type {
    TaskContext,
    TaskFn,
    TaskSkipFn,
} from '../def.js';


export const setupPm2Skip : TaskSkipFn = async(ctx : TaskContext) => {
    if (ctx.config.pm2 === false) {
        return 'PM2 disabled';
    }
    const pm2ConfigExists = await ctx.test('test -f pm2.config.*');
    if (!pm2ConfigExists) {
        return 'PM2 config not found';
    }
    return false;
};

export const setupPm2Task : TaskFn = async(ctx : TaskContext) => {
    await ctx.run('pm2 start pm2.config.* --update-env');
    await ctx.run('pm2 save');
};
