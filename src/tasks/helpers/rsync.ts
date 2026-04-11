import type { FilesConfigBase, RsyncOptions, ServerConfig } from '../../def.js';

export function buildRsyncCommand (
    server : ServerConfig,
    source : string,
    dest : string,
    files : FilesConfigBase,
    options : RsyncOptions = {},
) : string
{
    options = {
        delete: true,
        dryRun: false,
        ...options,
    };
    
    const args : string[] = [ 'rsync', '-avz', '--progress=info2' ];
    
    if (options.delete) {
        args.push('--delete');
    }
    
    if (options.dryRun) {
        args.push('--dry-run');
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
