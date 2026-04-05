import type {
    Placeholders,
    TaskContext,
    TaskFn,
    TaskSkipFn,
} from '../def.js';


export const symlinksSkip : TaskSkipFn = (ctx : TaskContext) => {
    const symlinks = ctx.config.symlinks;
    return !symlinks || symlinks.length === 0
        ? 'No symlinks defined in config'
        : false
        ;
};

export const symlinksTask : TaskFn = async(ctx : TaskContext, ph : Placeholders) => {
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
