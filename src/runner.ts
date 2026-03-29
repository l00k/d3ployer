import chalk from 'chalk';
import type { ListrRenderer } from 'listr2';
import { Listr } from 'listr2';
import { spawn } from 'node:child_process';
import type SSH2Promise from 'ssh2-promise';
import { createSSHConnection } from './connection.js';
import type {
    DeployerConfig,
    ExecResult,
    Placeholders,
    RunOptions,
    ServerConfig,
    TaskContext,
    TaskDef,
} from './def.js';
import { Exception } from './utils/Exception.js';


type ExecLocalOptions = {
    ignoreError? : boolean;
    printOutput? : boolean;
    cwd? : string;
}

function execLocal (
    command : string,
    options : ExecLocalOptions,
) : Promise<ExecResult>
{
    const result : ExecResult = {
        success: undefined,
        code: undefined,
        stdout: '',
        stderr: '',
    };
    
    return new Promise((resolve, reject) => {
        const child = spawn('sh', [ '-c', command ], {
            cwd: options.cwd,
            stdio: [ 'inherit', 'pipe', 'pipe' ],
        });
        
        child.stdout.on('data', (data : Buffer) => {
            const text = data.toString();
            result.stdout += text;
            
            if (options.printOutput) {
                process.stdout.write(text);
            }
        });
        
        child.stderr.on('data', (data : Buffer) => {
            const text = data.toString();
            result.stderr += text;
            
            if (options.printOutput) {
                process.stderr.write(text);
            }
        });
        
        child.on('close', (code) => {
            result.code = code;
            result.success = code === 0;
            
            if (
                code !== 0
                && !options.ignoreError
            ) {
                reject(
                    new Exception(
                        `Local command failed (exit ${code}): ${command}\n${result.stderr}`,
                        1774742010146,
                    ),
                );
                return;
            }
            
            resolve(result);
        });
        
        child.on('error', (err) => {
            reject(
                new Exception(
                    `Local command failed: ${command}\n${err.message}`,
                    1774742013175,
                ),
            );
        });
    });
}


type ExecRemoteOptions = {
    ignoreError? : boolean;
    printOutput? : boolean;
    cwd? : string;
    initCmd? : string;
}

function execRemote (
    ssh : SSH2Promise,
    command : string,
    options : ExecRemoteOptions,
) : Promise<ExecResult>
{
    const result : ExecResult = {
        success: undefined,
        code: undefined,
        stdout: '',
        stderr: '',
    };
    
    const parts = [];
    if (options.cwd) {
        parts.push(`cd ${options.cwd}`);
    }
    if (options.initCmd) {
        parts.push(options.initCmd);
    }
    parts.push(command);
    const wrappedCommand = parts.join('; \\\n');
    
    return new Promise((resolve, reject) => {
        ssh.spawn(wrappedCommand)
            .then((stream : any) => {
                stream.on('data', (data : Buffer) => {
                    const text = data.toString();
                    result.stdout += text;
                    
                    if (options.printOutput) {
                        process.stdout.write(text);
                    }
                });
                
                stream.stderr.on('data', (data : Buffer) => {
                    const text = data.toString();
                    result.stderr += text;
                    
                    if (options.printOutput) {
                        process.stderr.write(text);
                    }
                });
                
                stream.on('close', (code : number) => {
                    result.code = code;
                    result.success = code === 0;
                    
                    if (
                        code !== 0
                        && !options.ignoreError
                    ) {
                        reject(
                            new Exception(
                                `Remote command failed (exit ${code}): ${command}\n${result.stderr}`,
                                1774742047909,
                            ),
                        );
                        return;
                    }
                    
                    resolve(result);
                });
            })
            .catch((err : Error) => {
                reject(
                    new Exception(
                        `Remote command failed: ${command}\n${err.message}`,
                        1774742062700,
                    ),
                );
            });
    });
}

function buildPlaceholders (serverName : string, server : ServerConfig) : Placeholders
{
    return {
        serverName,
        deployPath: server.deployPath,
        timestamp: new Date().toISOString().replace(/[:.]/g, '-'),
    };
}

function buildTaskContext (
    serverName : string,
    server : ServerConfig,
    ssh : SSH2Promise,
    config : DeployerConfig,
) : TaskContext
{
    return {
        server: { ...server, name: serverName },
        ssh,
        config,
        
        runLocal: (cmd : string, options : RunOptions = {}) => {
            options = {
                ignoreError: false,
                printOutput: true,
                ...options,
            };
            return execLocal(
                cmd,
                {
                    cwd: config.rootDir,
                    ...options,
                },
            );
        },
        testLocal: async(cmd : string) => {
            const result = await execLocal(
                cmd,
                {
                    ignoreError: true,
                    printOutput: false,
                    cwd: config.rootDir,
                },
            );
            return result.success;
        },
        
        run: (cmd : string, options : RunOptions = {}) => {
            options = {
                ignoreError: false,
                printOutput: true,
                ...options,
            };
            return execRemote(
                ssh,
                cmd,
                {
                    cwd: server.deployPath,
                    initCmd: server.initCmd,
                    ...options,
                },
            );
        },
        test: async(cmd : string) => {
            const result = await execRemote(
                ssh,
                cmd,
                {
                    ignoreError: true,
                    printOutput: false,
                    cwd: server.deployPath,
                    initCmd: server.initCmd,
                },
            );
            return result.success;
        },
    };
}

export function resolveServers (
    config : DeployerConfig,
    serverNames? : string[],
) : Array<[ string, ServerConfig ]>
{
    const allEntries = Object.entries(config.servers);
    
    if (!serverNames || serverNames.length === 0) {
        return allEntries;
    }
    
    const result : Array<[ string, ServerConfig ]> = [];
    for (const name of serverNames) {
        const server = config.servers[name];
        if (!server) {
            const available = Object.keys(config.servers).join(', ');
            throw new Exception(
                `Server "${name}" not found. Available: ${available}`,
                1774742073310,
            );
        }
        result.push([ name, server ]);
    }
    return result;
}

export function resolveTaskDefs (
    taskNames : string[],
    allTasks : Record<string, TaskDef>,
) : Array<[ string, TaskDef ]>
{
    return taskNames.map(name => {
        const def = allTasks[name];
        if (!def) {
            const available = Object.keys(allTasks).join(', ');
            throw new Exception(
                `Task "${name}" not found. Available: ${available}`,
                1774742082083,
            );
        }
        return [ name, def ];
    });
}

const listrOptions : typeof ListrRenderer.rendererOptions = {
    concurrent: false,
    renderer: 'simple',
    rendererOptions: {
        clearOutput: true,
    },
};

function buildServerListr (
    serverName : string,
    server : ServerConfig,
    config : DeployerConfig,
    tasks : Array<[ string, TaskDef ]>,
) : Listr
{
    return new Listr([
        {
            task: async(ctx) => {
                const ssh = createSSHConnection(server);
                await ssh.connect();
                ctx.ssh = ssh;
                ctx.taskCtx = buildTaskContext(serverName, server, ssh, config);
                ctx.ph = buildPlaceholders(serverName, server);
            },
        },
        ...tasks.map(([ _key, taskDef ]) => ({
            title: chalk.bgCyan.black(` ${taskDef.name} `),
            task: async(ctx : any, task : any) => taskDef.fn(ctx.taskCtx, ctx.ph),
            options: listrOptions,
        })),
        {
            task: async(ctx) => {
                if (ctx.ssh) {
                    await ctx.ssh.close();
                }
            },
        },
    ], listrOptions);
}

export async function runScenario (
    config : DeployerConfig,
    scenarioName : string,
    serverNames? : string[],
) : Promise<void>
{
    const scenarioDef = config.scenarios?.[scenarioName];
    if (!scenarioDef) {
        const available = Object.keys(config.scenarios ?? {}).join(', ') || 'none';
        throw new Exception(
            `Scenario "${scenarioName}" not found. Available: ${available}`,
            1774742090385,
        );
    }
    
    const allTasks = config.tasks ?? {};
    const tasks = resolveTaskDefs(scenarioDef.tasks, allTasks);
    const servers = resolveServers(config, serverNames);
    
    const listr = new Listr(
        servers.map(([ name, server ]) => ({
            title: chalk.bgMagenta.black(` ${name} (${server.host}) `),
            task: () : Listr => buildServerListr(name, server, config, tasks),
            options: listrOptions,
        })),
        listrOptions,
    );
    
    await listr.run();
}

export async function runTask (
    config : DeployerConfig,
    taskName : string,
    serverNames? : string[],
) : Promise<void>
{
    const allTasks = config.tasks ?? {};
    const taskDef = allTasks[taskName];
    if (!taskDef) {
        const available = Object.keys(allTasks).join(', ') || 'none';
        throw new Exception(
            `Task "${taskName}" not found. Available: ${available}`,
            1774742100356,
        );
    }
    
    const servers = resolveServers(config, serverNames);
    
    const listr = new Listr(
        servers.map(([ name, server ]) => ({
            title: chalk.bgMagenta.black(` ${name} (${server.host}) `),
            task: () : Listr => buildServerListr(name, server, config, [ [ taskName, taskDef ] ]),
            options: listrOptions,
        })),
        listrOptions,
    );
    
    await listr.run();
}
