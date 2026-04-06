import { set } from 'lodash-es';
import fs from 'node:fs';
import path from 'node:path';
import type { DeployerConfig } from './def.js';
import { Exception } from './utils/Exception.js';

const CONFIG_FILENAME = 'deployer.config.ts';

export function findConfigFile (startDir : string = process.cwd()) : string
{
    let dir = path.resolve(startDir);
    
    let parent = dir;
    do {
        dir = parent;
        const candidate = path.join(dir, CONFIG_FILENAME);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
        parent = path.dirname(dir);
    }
    while (parent !== dir);
    
    throw new Exception(
        `Could not find ${CONFIG_FILENAME} in ${startDir} or any parent directory`,
        1774741892462,
    );
}

export async function loadConfig (
    configPath? : string,
    configOverrides? : string[],
) : Promise<DeployerConfig>
{
    const resolvedPath = configPath ?? findConfigFile();
    const absolutePath = path.resolve(resolvedPath);
    
    if (!fs.existsSync(absolutePath)) {
        throw new Exception(
            `Config file not found: ${absolutePath}`,
            1774741902017,
        );
    }
    
    const module = await import(absolutePath);
    const config : DeployerConfig = module.default ?? module;
    
    config.rootDir = path.dirname(absolutePath);
    
    if (!config.servers || Object.keys(config.servers).length === 0) {
        throw new Exception(
            'Config must define at least one server',
            1774741913430,
        );
    }
    
    // override task config if provided via CLI
    if (configOverrides) {
        for (const configOverride of configOverrides) {
            const eqIdx = configOverride.indexOf('=');
            if (eqIdx === -1) {
                console.warn(`Invalid task config override (missing '='): ${configOverride}`);
                continue;
            }
            
            const overrideKey = configOverride.slice(0, eqIdx);
            const rawValue = configOverride.slice(eqIdx + 1);
            
            const keyParts = overrideKey.split('.');
            if (keyParts.length < 2) {
                console.warn(`Invalid task config override key: ${overrideKey}`);
                continue;
            }
            
            const [ taskName, ...configPathParts ] = keyParts;
            const taskDef = config.tasks?.[taskName];
            if (!taskDef) {
                console.warn(`Task not found for config override: ${taskName}`);
                continue;
            }
            
            if (!taskDef.config) {
                taskDef.config = {};
            }
            
            const value = rawValue === 'true'
                ? true
                : rawValue === 'false'
                    ? false
                    : rawValue !== '' && !isNaN(Number(rawValue))
                        ? Number(rawValue)
                        : rawValue
            ;
            
            set(taskDef.config, configPathParts, value);
        }
    }
    
    return config;
}
