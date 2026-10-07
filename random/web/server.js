const http = require('node:http');
const { readFile } = require('node:fs/promises');
const { randomInt } = require('node:crypto');

const port = Number(process.env.PORT || 80);
const configPath = process.env.DESTINATIONS_PATH || '/data/destinations.json';

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

  try {
    const config = JSON.parse(await readFile(configPath, 'utf8'));
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

module.exports = { validDestination };
