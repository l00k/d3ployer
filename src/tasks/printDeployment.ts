import chalk from 'chalk';
import type {
    Placeholders,
    TaskContext,
    TaskFn,
} from '../def.js';


export const printDeploymentTask : TaskFn = async(ctx : TaskContext, ph : Placeholders) => {
    await ctx.run('date');

    console.log(
        chalk.cyan('Deployment directory'),
        ph.deployPath,
    );
    await ctx.run('ls -la .');

    console.log(chalk.cyan('Directory size'));
    await ctx.run('du -hd 1 .');
};
