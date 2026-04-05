import { ListrEnquirerPromptAdapter } from '@listr2/prompt-adapter-enquirer';
import chalk from 'chalk';
import type { ListrTaskWrapper } from 'listr2';
import type { Placeholders, TaskContext, TaskFn } from '../def.js';


export const clearTargetTask : TaskFn = async(
    ctx : TaskContext,
    ph : Placeholders,
    task : ListrTaskWrapper<any, any, any>,
) => {
    const confirmed = await task.prompt(ListrEnquirerPromptAdapter).run<boolean>({
        type: 'Confirm',
        message: chalk.red(`Remove entire deploy path ${ph.deployPath} on ${ctx.server.host}?`),
        initial: false,
    });
    
    console.log();
    
    if (!confirmed) {
        task.skip('Skipped clearing target');
        return;
    }
    
    await ctx.run(`rm -rf ${ph.deployPath}`);
};
