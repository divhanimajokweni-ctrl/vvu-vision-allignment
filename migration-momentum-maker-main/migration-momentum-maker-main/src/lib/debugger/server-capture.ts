import { debuggerClient, captureHttp } from './client';

export function attachProcessCapture() {
  process.on('uncaughtException', (err) => {
    debuggerClient.captureAmbient({ type: 'error', level: 'error', source: 'process', message: `uncaughtException: ${err.message}`, data: { stack: err.stack?.slice(0, 4000) } });
  });
  process.on('unhandledRejection', (reason) => {
    debuggerClient.captureAmbient({ type: 'error', level: 'error', source: 'process', message: `unhandledRejection: ${String(reason).slice(0, 500)}` });
  });
  if (process.env.DEBUGGER_HEARTBEAT === '1') {
    setInterval(() => {
      const m = process.memoryUsage();
      debuggerClient.captureAmbient({ type: 'metric', level: 'info', source: 'process', message: 'heartbeat', data: { rssMb: Math.round(m.rss / 1048576), heapMb: Math.round(m.heapUsed / 1048576) } });
    }, 60_000);
  }
}

export async function captureRequestError(req: Request, error: Error & { digest?: string }, ctx?: { routerKind?: string; routePath?: string; routeType?: string }) {
  const url = typeof req.url === 'string' ? req.url : '/';
  debuggerClient.captureAmbient({ type: 'error', level: 'error', source: 'next', message: `request error: ${error.message}`.slice(0, 500), data: { digest: error.digest, route: ctx?.routePath, router: ctx?.routerKind, url: url.slice(0, 300) } });
}

export { captureHttp };
