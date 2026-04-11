import { defaultsDeep } from 'lodash-es';
import os from 'node:os';
import type {
    DeployerConfig,
    DeployerConfigInput,
    ScenarioDef,
    ScenarioInput,
    ServerConfig,
    ServerConfigInput,
    TaskConfigBase,
    TaskDef,
    TaskInput,
} from './def.js';
import { defaultScenarios, defaultTasks } from './tasks/index.js';


const SERVER_DEFAULTS : Omit<ServerConfig, 'host' | 'deployPath'> = {
    port: 22,
    username: os.userInfo().username,
    authMethod: 'agent',
};

function resolveServer (input : ServerConfigInput) : ServerConfig
{
    return defaultsDeep({}, input, SERVER_DEFAULTS);
}

function normalizeTask (key : string, input : TaskInput) : TaskDef
{
    if (typeof input === 'function') {
        return {
            name: key,
            task: input,
        };
    }
    return {
        name: input.name ?? key,
        task: input.task,
        skip: input.skip,
        config: input.config,
    };
}

function normalizeScenario (key : string, input : ScenarioInput) : ScenarioDef
{
    if (Array.isArray(input)) {
        return {
            name: key,
            tasks: input,
        };
    }
    return {
        name: input.name,
        tasks: input.tasks,
    };
}

export function defineTask<C> (input : TaskConfigBase<C>) : TaskConfigBase<C>
{
    return input;
}

export function defineConfig (input : DeployerConfigInput) : DeployerConfig
{
    const servers : Record<string, ServerConfig> = {};
    for (const [ name, serverInput ] of Object.entries(input.servers)) {
        servers[name] = resolveServer(serverInput);
    }
    
    const tasks : Record<string, TaskDef> = {};
    for (const [ key, taskDef ] of Object.entries(defaultTasks)) {
        tasks[key] = taskDef;
    }
    if (input.tasks) {
        for (const [ key, taskInput ] of Object.entries(input.tasks)) {
            tasks[key] = normalizeTask(key, taskInput);
        }
    }
    
    const scenarios : Record<string, ScenarioDef> = {};
    for (const [ key, scenarioDef ] of Object.entries(defaultScenarios)) {
        scenarios[key] = {
            ...scenarioDef,
            tasks: scenarioDef.tasks,
        };
    }
    if (input.scenarios) {
        for (const [ key, scenarioInput ] of Object.entries(input.scenarios)) {
            const normalized = normalizeScenario(key, scenarioInput);
            scenarios[key] = {
                ...normalized,
                tasks: normalized.tasks,
            };
        }
    }
    
    return defaultsDeep(
        {
            rootDir: '',
            
            ...input,
            
            servers,
            tasks,
            scenarios,
        },
        {
            packageManager: {
                manager: 'npm',
                productionOnly: true,
            },
            pm2: {
                logs: {
                    lines: 25,
                    time: 3,
                },
            },
            dockerCompose: {
                configFiles: undefined,
                logs: {
                    lines: 25,
                    time: 3,
                },
            },
        } satisfies Partial<DeployerConfig>,
    );
}
