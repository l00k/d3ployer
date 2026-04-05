import type {
    PackageManagerConfig,
    TaskContext,
    TaskFn,
    TaskSkipFn,
} from '../def.js';
import { Exception } from '../utils/index.js';


export const installPackagesSkip : TaskSkipFn = (ctx : TaskContext) => {
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

export const installPackagesTask : TaskFn = async(ctx : TaskContext) => {
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
