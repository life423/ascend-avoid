import type { RequestHandler } from 'express';

export const PUBLIC_ORIGIN = 'https://ascendavoid.com';
const REDIRECT_HOSTS = new Set(['ascend.drewclark.io', 'www.ascendavoid.com']);
const DOCUMENT_PATHS = new Set(['/', '/index.html', '/privacy-policy.html']);
const DEFAULT_ORIGINS = [PUBLIC_ORIGIN, 'https://www.ascendavoid.com', 'https://ascend.drewclark.io',
  'http://localhost:5173', 'http://127.0.0.1:5173'];

/** An explicit staging/development override retains its existing replacement semantics. */
export function publicCorsOrigins(override?: string): string[] {
  return (override ?? DEFAULT_ORIGINS.join(',')).split(',').map(origin => origin.trim()).filter(Boolean);
}

/** Keep old clients' assets, matchmaking and sockets available while document visits move. */
export const redirectPublicDocuments: RequestHandler = (req, res, next) => {
  if (!REDIRECT_HOSTS.has((req.hostname ?? '').toLowerCase()) || !DOCUMENT_PATHS.has(req.path) ||
      !['GET', 'HEAD'].includes(req.method) || req.headers.upgrade) {
    next();
    return;
  }
  const queryStart = req.originalUrl.indexOf('?');
  const query = queryStart < 0 ? '' : req.originalUrl.slice(queryStart);
  const destinationPath = req.path === '/index.html' ? '/' : req.path;
  // Both the destination origin and permitted paths are fixed, never supplied by a query/Host value.
  res.redirect(308, `${PUBLIC_ORIGIN}${destinationPath}${query}`);
};
