import type SSH2Promise from 'ssh2-promise';

export type AuthMethod = 'key' | 'password' | 'agent';

export type PackageManager = 'npm' | 'yarn' | 'pnpm';

export type PackageManagerConfig = {
    manager : PackageManager;
    productionOnly? : boolean;
}

export interface ServerConfig
{
    host : string;
    port : number;
    username : string;
    authMethod : AuthMethod;
    privateKey? : string;
    password? : string;
    agent? : string;
    deployPath : string;
    packageManager? : PackageManagerConfig | false;
    initCmd? : string;
}

export type ServerConfigInput = Partial<ServerConfig> & Pick<ServerConfig, 'host' | 'deployPath'>;

export interface FilesConfig
{
    basePath? : string;
    include? : string[];
    exclude? : string[];
}

export interface SymlinkConfig
{
    path : string;
    target : string;
}

export interface LogsConfig
{
    time? : number;
}

export interface Placeholders
{
    serverName : string;
    deployPath : string;
    timestamp : string;
}

export type ExecResult = {
    success : boolean;
    code : number;
    stdout : string;
    stderr : string;
}

export type RunOptions = {
    printOutput? : boolean;
    ignoreError? : boolean;
}

export interface TaskContext
{
    server : ServerConfig & { name : string };
    ssh : SSH2Promise;
    config : DeployerConfig;
    runLocal : (cmd : string, options? : RunOptions) => Promise<ExecResult>;
    testLocal : (cmd : string) => Promise<boolean>;
    run : (cmd : string, options? : RunOptions) => Promise<ExecResult>;
    test : (cmd : string) => Promise<boolean>;
    taskConfig? : any;
}

export type TaskFn = (ctx : TaskContext, ph : Placeholders) => Promise<void>;

export type TaskSkipFn = (ctx : TaskContext, ph : Placeholders) => Promise<boolean | string> | boolean | string;

export interface TaskDef
{
    name : string;
    task : TaskFn;
    skip? : TaskSkipFn;
    config? : any;
}

export type TaskInput = TaskFn | {
    name? : string;
    task : TaskFn;
    skip? : TaskSkipFn,
    config? : any;
};

export interface ScenarioDef
{
    name : string;
    tasks : string[];
}

export type ScenarioInput = string[] | { name : string; tasks : string[] };

export interface DeployerConfig
{
    rootDir : string;
    servers : Record<string, ServerConfig>;
    files? : FilesConfig;
    symlinks? : SymlinkConfig[];
    packageManager? : PackageManagerConfig | false;
    pm2? : boolean;
    dockerCompose? : boolean;
    logs? : LogsConfig | false;
    tasks? : Record<string, TaskDef>;
    scenarios? : Record<string, ScenarioDef>;
}

export type DeployerConfigInput = Omit<DeployerConfig, 'servers' | 'rootDir' | 'tasks' | 'scenarios'> & {
    servers : Record<string, ServerConfigInput>;
    tasks? : Record<string, TaskInput>;
    scenarios? : Record<string, ScenarioInput>;
};
