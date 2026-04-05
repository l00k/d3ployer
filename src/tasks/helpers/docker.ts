import type { DockerComposeConfig } from '$/def.js';

export function buildDockerComposeTestCmd (dockerComposeConfig : DockerComposeConfig | false) : string
{
    if (dockerComposeConfig === false) {
        return 'false';
    }
    
    const configFiles = dockerComposeConfig.configFiles ?? [
        'docker-compose.yml',
        'docker-compose.yaml',
        'compose.yml',
        'compose.yaml',
    ];
    const testCmdPart = configFiles.map(f => `-f ${f}`);
    
    return `test ${testCmdPart.join(' -o ')}`;
}
