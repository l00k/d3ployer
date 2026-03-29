import fs from 'node:fs';
import SSH2Promise from 'ssh2-promise';
import type { ServerConfig } from './def.js';
import { Exception } from './utils/Exception.js';

export function createSSHConnection (server : ServerConfig) : SSH2Promise
{
    const sshConfig : any = {
        host: server.host,
        port: server.port ?? 22,
        username: server.username,
        reconnect: false,
    };
    
    switch (server.authMethod ?? 'agent') {
        case 'key':
            if (!server.privateKey) {
                throw new Exception(
                    `Server "${server.host}": privateKey is required for key auth`,
                    1774741923779,
                );
            }
            sshConfig.privateKey = fs.readFileSync(server.privateKey);
            break;
        case 'password':
            if (!server.password) {
                throw new Exception(
                    `Server "${server.host}": password is required for password auth`,
                    1774741926213,
                );
            }
            sshConfig.password = server.password;
            break;
        case 'agent':
            sshConfig.agent = server.agent ?? process.env.SSH_AUTH_SOCK;
            break;
    }
    
    console.log(`Connecting to ${server.username}@${server.host}:${sshConfig.port}`);
    return new SSH2Promise(sshConfig);
}
