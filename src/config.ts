import { defaultsDeep } from 'lodash-es';
import os from 'node:os';
import type {
    DockerComposeConfig,
    PackageManagerConfig,
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

export function camelToColonCase (str : string) : string
{
    return str.replace(/([a-z0-9])([A-Z])/g, '$1:$2').toLowerCase();
}

export function defineConfig (input : DeployerConfigInput) : DeployerConfig
{
    const servers : Record<string, ServerConfig> = {};
    for (const [ name, serverInput ] of Object.entries(input.servers)) {
        servers[name] = resolveServer(serverInput);
    }
    
    const tasks : Record<string, TaskDef> = {};
    for (const [ key, taskDef ] of Object.entries(defaultTasks)) {
        tasks[camelToColonCase(key)] = taskDef;
    }
    if (input.tasks) {
        for (const [ key, taskInput ] of Object.entries(input.tasks)) {
            tasks[camelToColonCase(key)] = normalizeTask(key, taskInput);
        }
    }
    
    const scenarios : Record<string, ScenarioDef> = {};
    for (const [ key, scenarioDef ] of Object.entries(defaultScenarios)) {
        scenarios[camelToColonCase(key)] = {
            ...scenarioDef,
            tasks: scenarioDef.tasks.map(camelToColonCase),
        };
    }
    if (input.scenarios) {
        for (const [ key, scenarioInput ] of Object.entries(input.scenarios)) {
            const normalized = normalizeScenario(key, scenarioInput);
            scenarios[camelToColonCase(key)] = {
                ...normalized,
                tasks: normalized.tasks.map(camelToColonCase),
            };
        }
    }
    
    let packageManager : PackageManagerConfig | false;
    if (input.packageManager === false) {
        packageManager = false;
    }
    else {
        packageManager = {
            manager: 'npm',
            productionOnly: true,
            ...input.packageManager,
        };
    }
    
    let dockerCompose : DockerComposeConfig | false;
    if (input.dockerCompose === false) {
        dockerCompose = false;
    }
    else {
        dockerCompose = {
            configFiles: undefined,
            ...input.dockerCompose,
        };
    }
    
    return {
        rootDir: '',
        ...input,
        packageManager,
        dockerCompose,
        servers,
        tasks,
        scenarios,
    };
}
