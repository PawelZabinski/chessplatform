import { createServer } from 'node:http';
import { readBackendConfig } from './config.ts';
import { createBackendRouter } from './http/router.ts';
import { createLogger } from './logging.ts';
import { MatchRegistry } from './matches/registry.ts';
import { attachMatchWebSocket } from './matches/websocket.ts';

const config = readBackendConfig();
const logger = createLogger(config.logLevel);
const matches = new MatchRegistry(logger);
const startedAt = Date.now();

const backend = createServer(createBackendRouter({ matches, startedAt }));
const matchSockets = attachMatchWebSocket({
	server: backend,
	path: config.matchWebSocketPath,
	registry: matches,
	logger
});

backend.listen(config.port, config.host, () => {
	logger.info('backend.listening', {
		host: config.host,
		port: config.port,
		matchWebSocketPath: config.matchWebSocketPath
	});
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.on(signal, () => {
		logger.info('backend.stopping', { signal });
		matchSockets.close();
		backend.close(() => process.exit(0));
	});
}
