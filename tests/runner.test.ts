import { expect } from 'chai';
import { defineConfig } from '$/config.js';
import { runScenario, runTask } from '$/runner.js';

describe('runner', () => {
    describe('runScenario', () => {
        it('should throw when scenario not found', async () => {
            const config = defineConfig({
                servers: { s1: { host: 'localhost', deployPath: '/d' } },
                scenarios: {},
            });

            try {
                await runScenario(config, 'nonexistent');
                expect.fail('Should have thrown');
            } catch (err: any) {
                expect(err.message).to.include('Scenario "nonexistent" not found');
            }
        });

        it('should throw when task in scenario not found', async () => {
            const config = defineConfig({
                servers: { s1: { host: 'localhost', deployPath: '/d' } },
                scenarios: { deploy: [ 'missing-task' ] },
                tasks: {},
            });

            try {
                await runScenario(config, 'deploy');
                expect.fail('Should have thrown');
            } catch (err: any) {
                expect(err.message).to.include('Task "missing-task" not found');
            }
        });

        it('should throw when server filter matches nothing', async () => {
            const config = defineConfig({
                servers: { s1: { host: 'localhost', deployPath: '/d' } },
                scenarios: { deploy: [] },
                tasks: {},
            });

            try {
                await runScenario(config, 'deploy', [ 'nonexistent' ]);
                expect.fail('Should have thrown');
            } catch (err: any) {
                expect(err.message).to.include('Server "nonexistent" not found');
            }
        });
    });

    describe('runTask', () => {
        it('should throw when task not found', async () => {
            const config = defineConfig({
                servers: { s1: { host: 'localhost', deployPath: '/d' } },
                tasks: {},
            });

            try {
                await runTask(config, 'nonexistent');
                expect.fail('Should have thrown');
            } catch (err: any) {
                expect(err.message).to.include('Task "nonexistent" not found');
            }
        });
    });
});
