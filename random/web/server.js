const http = require('node:http');
const { readFile } = require('node:fs/promises');
const { randomInt } = require('node:crypto');
const { join } = require('node:path');

const port = Number(process.env.PORT || 80);
const destinationsDir = process.env.DESTINATIONS_DIR || '/data/domains';

function hostnameFromHostHeader(value) {
  if (typeof value !== 'string') return null;
  const match = /^([^:]+)(?::(\d{1,5}))?$/.exec(value.toLowerCase());
  if (!match || (match[2] && (Number(match[2]) < 1 || Number(match[2]) > 65535))) return null;
  const hostname = match[1];
  if (hostname.length > 253 || !hostname.split('.').every((label) =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return hostname;
}

function validDestination(value) {
  if (typeof value !== 'string' || !value || /\s|[\x00-\x1f\x7f]/.test(value)) {
    return false;
  }
  try {
    const url = new URL(value);
    return /^https?:\/\//i.test(value) && (url.protocol === 'http:' || url.protocol === 'https:')
      && Boolean(url.hostname);
  } catch {
    return false;
  }
}

const server = http.createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');

  if (request.url === '/healthz') {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('ok\n');
    return;
  }

  if ((request.method !== 'GET' && request.method !== 'HEAD')
      || (request.url !== '/' && !request.url.startsWith('/?'))) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found\n');
    return;
  }

  const hostname = hostnameFromHostHeader(request.headers.host);
  if (!hostname) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Invalid Host\n');
    return;
  }

  let contents;
  try {
    contents = await readFile(join(destinationsDir, hostname, 'destinations.json'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Unknown site\n');
      return;
    }
    console.error('Redirect configuration read failed:', error);
    response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Redirect unavailable\n');
    return;
  }

  try {
    const config = JSON.parse(contents);
    const destinations = config.destinations;
    if (!Array.isArray(destinations) || destinations.length === 0 || destinations.length > 20
        || !destinations.every(validDestination)) {
      throw new Error('Invalid destinations configuration');
    }
    response.writeHead(302, { Location: destinations[randomInt(destinations.length)] });
    response.end();
  } catch (error) {
    console.error('Redirect configuration failed:', error);
    response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Redirect unavailable\n');
  }
});

if (require.main === module) {
  server.listen(port, '0.0.0.0', () => {
    console.log(`Redirect server listening on port ${port}`);
  });
}

module.exports = { hostnameFromHostHeader, validDestination };
