/**
 * Next.js native instrumentation.
 * The dynamic import ensures Node-only modules (process, crypto) are not
 * evaluated in the Edge runtime during build.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const mod = await import('@/lib/debugger/server-capture');
    mod.attachProcessCapture();
  }
}

export async function onRequestError(
  req: Request,
  error: Error & { digest?: string },
  ctx: { routerKind: 'app' | 'pages'; routePath: string; routeType: 'render' | 'route' | 'action' },
) {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const mod = await import('@/lib/debugger/server-capture');
    await mod.captureRequestError(req, error, ctx);
  }
}
