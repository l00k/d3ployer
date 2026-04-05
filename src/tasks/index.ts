import type { ScenarioDef, TaskDef } from '../def.js';
import { clearTargetTask } from './clearTarget.js';
import { downloadSkip, downloadTask } from './download.js';
import { installPackagesSkip, installPackagesTask } from './installPackages.js';
import { printDeploymentTask } from './printDeployment.js';
import { printLogsDockerSkip, printLogsDockerTask, printLogsPm2Skip, printLogsPm2Task } from './printLogs.js';
import { setupDockerSkip, setupDockerTask } from './setupDocker.js';
import { setupPm2Skip, setupPm2Task } from './setupPm2.js';
import { symlinksSkip, symlinksTask } from './symlinks.js';
import { uploadSkip, uploadTask } from './upload.js';


export { buildRsyncCommand } from './upload.js';
export type { RsyncOptions } from './upload.js';
export { downloadSkip, downloadTask } from './download.js';


export const defaultTasks : Record<string, TaskDef> = {
    'clear:target': {
        name: 'Clear target',
        task: clearTargetTask,
    },
    upload: {
        name: 'Upload files',
        skip: uploadSkip,
        task: uploadTask,
    },
    download: {
        name: 'Download files',
        skip: downloadSkip,
        task: downloadTask,
    },
    symlinks: {
        name: 'Create symlinks',
        skip: symlinksSkip,
        task: symlinksTask,
    },
    'install:packages': {
        name: 'Install packages',
        skip: installPackagesSkip,
        task: installPackagesTask,
    },
    'setup:pm2': {
        name: 'PM2 setup',
        skip: setupPm2Skip,
        task: setupPm2Task,
    },
    'setup:docker': {
        name: 'Docker Compose setup',
        skip: setupDockerSkip,
        task: setupDockerTask,
    },
    'print:deployment': {
        name: 'Print deployment info',
        task: printDeploymentTask,
    },
    'print:logs:pm2': {
        name: 'Print PM2 logs',
        skip: printLogsPm2Skip,
        task: printLogsPm2Task,
    },
    'print:logs:docker': {
        name: 'Print docker logs',
        skip: printLogsDockerSkip,
        task: printLogsDockerTask,
    },
};

export const defaultScenarios : Record<string, ScenarioDef> = {
    deploy: {
        name: 'Deploy',
        tasks: [
            'upload',
            'symlinks',
            'install:packages',
            'setup:pm2',
            'setup:docker',
            'print:deployment',
            'print:logs:pm2',
            'print:logs:docker',
        ],
    },
};
