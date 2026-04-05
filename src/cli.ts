#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import { loadConfig } from './configLoader.js';
import { runScenario, runTask } from './runner.js';

const program = new Command()
    .name('deployer')
    .description('TypeScript deployment tool')
    .option('-c, --config <path>', 'path to deployer.config.ts')
    .option('--skip <tasks>', 'comma-separated list of tasks to skip')
;

program
    .argument('<name>', 'scenario or task name')
    .argument('[servers...]', 'target server(s)')
    .action(async(name : string, servers : string[]) => {
        try {
            const opts = program.opts();
            const config = await loadConfig(opts.config);
            const serverList = servers.length > 0 ? servers : undefined;
            const skipTasks = opts.skip
                ? opts.skip.split(',').map((s : string) => s.trim()).filter(Boolean)
                : [];
            if (config.scenarios?.[name]) {
                await runScenario(config, name, serverList, { skip: skipTasks });
            }
            else {
                await runTask(config, name, serverList, { skip: skipTasks });
            }
        }
        catch (err : any) {
            console.error(err.message);
            process.exit(1);
        }
    });

program
    .command('list')
    .description('list available scenarios, tasks and servers')
    .action(async() => {
        try {
            const config = await loadConfig(program.opts().config);
            
            console.log(chalk.bold('\nScenarios:'));
            const scenarios = config.scenarios ?? {};
            const scenarioKeys = Object.keys(scenarios);
            if (scenarioKeys.length) {
                for (const key of scenarioKeys) {
                    const s = scenarios[key];
                    const label = s.name !== key ? `${chalk.cyan(key)} (${s.name})` : chalk.cyan(key);
                    console.log(`  ${label} → [${s.tasks.join(', ')}]`);
                }
            }
            else {
                console.log('  (none)');
            }

            console.log(chalk.bold('\nTasks:'));
            const tasks = config.tasks ?? {};
            const taskKeys = Object.keys(tasks);
            if (taskKeys.length) {
                for (const key of taskKeys) {
                    const t = tasks[key];
                    const label = t.name !== key ? `${chalk.cyan(key)} (${t.name})` : chalk.cyan(key);
                    console.log(`  ${label}`);
                }
            }
            else {
                console.log('  (none)');
            }
            
            console.log(chalk.bold('\nServers:'));
            for (const [ name, s ] of Object.entries(config.servers)) {
                console.log(`  ${chalk.cyan(name)} → ${s.username}@${s.host}:${s.port ?? 22} (${s.deployPath})`);
            }
            console.log();
        }
        catch (err : any) {
            console.error(err.message);
            process.exit(1);
        }
    });

program.parse();
