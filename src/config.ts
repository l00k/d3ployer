import { defaultsDeep } from 'lodash-es';
import os from 'node:os';
import type {
    DeployerConfig,
    DeployerConfigInput,
    ScenarioDef,
    ScenarioInput,
    ServerConfig,
    ServerConfigInput,
    TaskDef,
    TaskInput,
} from './def.js';
import { defaultScenarios, defaultTasks } from './defaultTasks.js';

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
        return { name: key, fn: input };
    }
    return { name: input.name, fn: input.task };
}

function normalizeScenario (key : string, input : ScenarioInput) : ScenarioDef
{
    if (Array.isArray(input)) {
        return { name: key, tasks: input };
    }
    return { name: input.name, tasks: input.tasks };
}

export function defineConfig (input : DeployerConfigInput) : DeployerConfig
{
    const servers : Record<string, ServerConfig> = {};
    for (const [ name, serverInput ] of Object.entries(input.servers)) {
        servers[name] = resolveServer(serverInput);
    }
    
    const tasks : Record<string, TaskDef> = { ...defaultTasks };
    if (input.tasks) {
        for (const [ key, taskInput ] of Object.entries(input.tasks)) {
            tasks[key] = normalizeTask(key, taskInput);
        }
    }
    
    const scenarios : Record<string, ScenarioDef> = { ...defaultScenarios };
    if (input.scenarios) {
        for (const [ key, scenarioInput ] of Object.entries(input.scenarios)) {
            scenarios[key] = normalizeScenario(key, scenarioInput);
        }
    }

    return {
        packageManager: 'npm',
        rootDir: '',
        ...input,
        servers,
        tasks,
        scenarios,
    };
}
