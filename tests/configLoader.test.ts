import { expect } from 'chai';
import path from 'node:path';
import { findConfigFile } from '$/configLoader.js';

describe('configLoader', () => {
    describe('findConfigFile', () => {
        it('should find config file in playground directory', () => {
            const playgroundDir = path.resolve(process.cwd(), 'playground');
            const result = findConfigFile(playgroundDir);
            expect(result).to.equal(path.join(playgroundDir, 'deployer.config.ts'));
        });

        it('should find config file searching upward from subdirectory', () => {
            const subDir = path.resolve(process.cwd(), 'playground', 'sample-app');
            const result = findConfigFile(subDir);
            expect(result).to.equal(
                path.resolve(process.cwd(), 'playground', 'deployer.config.ts'),
            );
        });

        it('should throw when no config file found', () => {
            expect(() => findConfigFile('/tmp')).to.throw('Could not find deployer.config.ts');
        });
    });
});
