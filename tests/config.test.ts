import os from 'node:os';
import { expect } from 'chai';
import { defineConfig } from '$/config.js';

describe('config builders', () => {
    describe('defineConfig', () => {
        it('should apply server defaults (port, username, authMethod)', () => {
            const config = defineConfig({
                servers: {
                    prod: {
                        host: '10.0.0.1',
                        deployPath: '/var/www/app',
                    },
                },
            });
            const prod = config.servers.prod;
            expect(prod.host).to.equal('10.0.0.1');
            expect(prod.port).to.equal(22);
            expect(prod.username).to.equal(os.userInfo().username);
            expect(prod.authMethod).to.equal('agent');
            expect(prod.deployPath).to.equal('/var/www/app');
        });

        it('should not override explicit server values', () => {
            const config = defineConfig({
                servers: {
                    prod: {
                        host: '10.0.0.1',
                        port: 2222,
                        username: 'deploy',
                        authMethod: 'key',
                        privateKey: '/home/deploy/.ssh/id_rsa',
                        deployPath: '/var/www/app',
                    },
                },
            });
            const prod = config.servers.prod;
            expect(prod.port).to.equal(2222);
            expect(prod.username).to.equal('deploy');
            expect(prod.authMethod).to.equal('key');
        });

        it('should apply defaults to each server independently', () => {
            const config = defineConfig({
                servers: {
                    staging: { host: 's1', deployPath: '/app', port: 2222 },
                    prod: { host: 's2', deployPath: '/app', username: 'root' },
                },
            });
            expect(config.servers.staging.port).to.equal(2222);
            expect(config.servers.staging.username).to.equal(os.userInfo().username);
            expect(config.servers.prod.port).to.equal(22);
            expect(config.servers.prod.username).to.equal('root');
        });

        it('should include default tasks (upload, symlinks)', () => {
            const config = defineConfig({
                servers: { s1: { host: 'h', deployPath: '/d' } },
            });
            const taskNames = Object.keys(config.tasks!);
            expect(taskNames).to.include('upload');
            expect(taskNames).to.include('symlinks');
        });

        it('should allow user tasks to override defaults', () => {
            const customUpload = async (): Promise<void> => {};
            const config = defineConfig({
                servers: { s1: { host: 'h', deployPath: '/d' } },
                tasks: { upload: customUpload },
            });
            expect(config.tasks!.upload).to.deep.eq({
                name: 'upload',
                task: customUpload,
            });
        });

        it('should merge user tasks with defaults', () => {
            const fn = async (): Promise<void> => {};
            const config = defineConfig({
                servers: { s1: { host: 'h', deployPath: '/d' } },
                tasks: { build: fn },
            });
            const taskNames = Object.keys(config.tasks!);
            expect(taskNames).to.include('upload');
            expect(taskNames).to.include('symlinks');
            expect(taskNames).to.include('build');
        });

        it('should support object-keyed scenarios', () => {
            const config = defineConfig({
                servers: { s1: { host: 'h', deployPath: '/d' } },
                scenarios: {
                    deploy: [ 'build', 'upload' ],
                    rollback: [ 'restore' ],
                },
            });
            
            expect(config.scenarios!.deploy).to.deep.equal({
                name: 'deploy',
                tasks: [ 'build', 'upload' ],
            });
            expect(config.scenarios!.rollback).to.deep.equal({
                name: 'rollback',
                tasks: [ 'restore' ],
            });
        });

        it('should support files config', () => {
            const config = defineConfig({
                servers: { s1: { host: 'h', deployPath: '/d' } },
                files: {
                    localPath: './dist',
                    include: [ '**/*.js' ],
                    exclude: [ 'node_modules' ],
                },
            });
            expect(config.files!.localPath).to.equal('./dist');
            expect(config.files!.include).to.deep.equal([ '**/*.js' ]);
        });

        it('should support symlinks config', () => {
            const config = defineConfig({
                servers: { s1: { host: 'h', deployPath: '/d' } },
                symlinks: [
                    { path: 'current', target: 'releases/latest' },
                ],
            });
            expect(config.symlinks).to.have.length(1);
            expect(config.symlinks![0].path).to.equal('current');
        });
    });
});
