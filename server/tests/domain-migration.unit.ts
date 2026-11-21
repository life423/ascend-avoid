import assert from 'node:assert/strict';
import { request as httpRequest, type Server } from 'node:http';
import { connect } from 'node:net';
import express from 'express';
import cors from 'cors';
import { publicCorsOrigins, redirectPublicDocuments, PUBLIC_ORIGIN } from '../http/publicDomain';

async function serve(override: string | undefined, check: (port: number) => Promise<void>): Promise<void> {
  const app = express();
  app.use(cors({ origin: publicCorsOrigins(override) }));
  app.use(redirectPublicDocuments);
  app.use((_req, res) => { res.sendStatus(204); });
  const server: Server = await new Promise(resolve => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const address = server.address();
  assert(address && typeof address !== 'string');
  try { await check(address.port); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

async function get(port: number, host: string, path = '/', method = 'GET', headers: Record<string, string> = {}) {
  return new Promise<{ status: number; location?: string; origin?: string }>((resolve, reject) => {
    const req = httpRequest({ hostname: '127.0.0.1', port, path, method, headers: { host, ...headers }, agent: false }, res => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode ?? 0, location: res.headers.location,
        origin: res.headers['access-control-allow-origin'] as string | undefined }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  await serve(undefined, async port => {
    for (const host of ['ascend.drewclark.io', 'www.ascendavoid.com', 'ASCEND.DREWCLARK.IO:443']) {
      for (const path of ['/', '/index.html', '/privacy-policy.html']) {
        for (const method of ['GET', 'HEAD']) {
          const query = '?next=https%3A%2F%2Felsewhere.example&raw=a%2Fb&repeat=1&repeat=2';
          const response = await get(port, host, path + query, method);
          assert.equal(response.status, 308, `${host} ${method} ${path} permanently redirects`);
          const destination = path === '/index.html' ? '/' : path;
          assert.equal(response.location, PUBLIC_ORIGIN + destination + query, 'query is retained on the fixed origin');
        }
      }
    }
    for (const host of ['ascendavoid.com', 'localhost:3000', '127.0.0.1:3000',
      'ascend-avoid-staging.livelyisland-db4ad2db.eastus.azurecontainerapps.io', 'elsewhere.example',
      'ascend.drewclark.io.elsewhere.example']) {
      const response = await get(port, host);
      assert.equal(response.status, 204, `${host} is not redirected`);
      assert.equal(response.location, undefined);
    }
    for (const host of ['ascend.drewclark.io', 'www.ascendavoid.com']) {
      for (const path of ['/health', '/assets/main.js', '/manifest.webmanifest', '/favicon.ico',
        '/.well-known/assetlinks.json', '/matchmake/joinOrCreate/game_room', '//elsewhere.example/']) {
        const response = await get(port, host, path);
        assert.equal(response.status, 204, `${host}${path} keeps its original handler`);
        assert.equal(response.location, undefined);
      }
      for (const method of ['POST', 'PUT', 'OPTIONS']) {
        const response = await get(port, host, '/', method);
        assert.equal(response.status, 204, `${method} is not redirected`);
        assert.equal(response.location, undefined);
      }
      assert.equal((await get(port, host, '/', 'GET', { upgrade: 'websocket' })).location, undefined,
        'upgrade-marked requests are not redirected');
    }
    assert.equal((await get(port, 'ascendavoid.com', '/', 'GET', { 'x-forwarded-host': 'ascend.drewclark.io' })).location,
      undefined, 'forwarded headers cannot redirect the primary host');
    const hostlessProbe = await new Promise<string>((resolve, reject) => {
      const socket = connect(port, '127.0.0.1', () => socket.write('GET /health HTTP/1.0\r\n\r\n'));
      let response = '';
      socket.setEncoding('utf8');
      socket.on('data', data => { response += data; });
      socket.on('end', () => resolve(response));
      socket.on('error', reject);
    });
    assert.match(hostlessProbe, /^HTTP\/1\.[01] 204 /, 'an HTTP/1.0 probe without Host reaches its handler');
    for (const origin of publicCorsOrigins()) {
      const response = await get(port, 'ascendavoid.com', '/health', 'GET', { origin });
      assert.equal(response.origin, origin, `${origin} is allowed`);
    }
    assert.equal((await get(port, 'ascendavoid.com', '/health', 'GET', { origin: 'https://elsewhere.example' })).origin,
      undefined, 'unlisted origins are not granted CORS access');
  });
  const staging = 'https://ascend-avoid-staging.livelyisland-db4ad2db.eastus.azurecontainerapps.io';
  await serve(` ${staging}, , `, async port => {
    assert.equal((await get(port, 'localhost', '/health', 'GET', { origin: staging })).origin, staging);
    assert.equal((await get(port, 'localhost', '/health', 'GET', { origin: PUBLIC_ORIGIN })).origin, undefined,
      'an explicit staging override replaces production defaults');
  });
  assert.deepEqual(publicCorsOrigins(''), [], 'an explicitly empty override remains empty');
  console.log('Domain redirect and CORS regressions passed');
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
