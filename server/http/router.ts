import type { IncomingMessage, ServerResponse } from 'node:http';
import type { MatchRegistry } from '../matches/registry.ts';

interface BackendRouterDependencies {
	matches: MatchRegistry;
	startedAt: number;
}

/** HTTP surface for health checks and future `/api/*` routes. */
export function createBackendRouter({ matches, startedAt }: BackendRouterDependencies) {
	return (request: IncomingMessage, response: ServerResponse) => {
		const path = new URL(request.url ?? '/', 'http://backend.local').pathname;

		if (request.method === 'GET' && path === '/health') {
			return json(response, 200, {
				ok: true,
				service: 'chessplatform-backend',
				rooms: matches.size,
				uptime: Math.max(0, (Date.now() - startedAt) / 1000)
			});
		}

		return json(response, 404, {
			error: 'not_found',
			message: `No backend route for ${request.method ?? 'UNKNOWN'} ${path}.`
		});
	};
}

function json(response: ServerResponse, status: number, body: unknown) {
	response.writeHead(status, {
		'content-type': 'application/json; charset=utf-8',
		'cache-control': 'no-store'
	});
	response.end(JSON.stringify(body));
}
