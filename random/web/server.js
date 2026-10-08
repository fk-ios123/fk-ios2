const http = require('node:http');
const { randomInt, timingSafeEqual } = require('node:crypto');
const { MongoClient } = require('mongodb');

const port = Number(process.env.PORT || 80);
const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DATABASE || 'random_redirect';
const reloadToken = process.env.WEB_RELOAD_TOKEN;
const refreshMs = Math.max(1000, Number(process.env.CACHE_REFRESH_MS) || 5000);

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
  if (typeof value !== 'string' || !value || /\s|[\x00-\x1f\x7f]/.test(value)) return false;
  try {
    const url = new URL(value);
    return /^https?:\/\//i.test(value) && (url.protocol === 'http:' || url.protocol === 'https:')
      && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function validSite(site) {
  return site && hostnameFromHostHeader(site._id) === site._id
    && Array.isArray(site.destinations) && site.destinations.length >= 1
    && site.destinations.length <= 20 && site.destinations.every(validDestination);
}

function authorized(request) {
  const provided = request.headers['x-reload-token'];
  if (!reloadToken || typeof provided !== 'string') return false;
  const expected = Buffer.from(reloadToken);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function start() {
  if (!mongoUri || !reloadToken) throw new Error('MONGODB_URI and WEB_RELOAD_TOKEN are required');
  const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const sites = client.db(databaseName).collection('sites');
  const cache = new Map();
  let refreshQueue = Promise.resolve();
  let refreshFailed = false;

  function queueRefresh(task) {
    const current = refreshQueue.then(task);
    refreshQueue = current.catch(() => {});
    return current;
  }

  async function refreshAll() {
    return queueRefresh(async () => {
      const documents = await sites.find({}, { projection: { _id: 1, destinations: 1 } }).toArray();
      const next = new Map();
      for (const site of documents) {
        if (!validSite(site)) throw new Error(`Invalid configuration for ${String(site._id)}`);
        next.set(site._id, site.destinations);
      }
      cache.clear();
      for (const [domain, destinations] of next) cache.set(domain, destinations);
      if (refreshFailed) console.log('Configuration refresh recovered');
      refreshFailed = false;
    });
  }

  async function refreshDomain(domain) {
    return queueRefresh(async () => {
      const site = await sites.findOne({ _id: domain }, { projection: { _id: 1, destinations: 1 } });
      if (site && !validSite(site)) throw new Error(`Invalid configuration for ${domain}`);
      if (site) cache.set(domain, site.destinations);
      else cache.delete(domain);
    });
  }

  await refreshAll();
  const timer = setInterval(() => {
    refreshAll().catch((error) => {
      if (!refreshFailed) console.error('Configuration refresh failed; serving last known configuration:', error);
      refreshFailed = true;
    });
  }, refreshMs);
  timer.unref();

  const server = http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');

    if (request.url?.startsWith('/__internal/reload')) {
      if (request.method !== 'POST' || !authorized(request)) {
        response.writeHead(403).end();
        return;
      }
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname !== '/__internal/reload') {
        response.writeHead(404).end();
        return;
      }
      const domain = url.searchParams.get('domain');
      if (!domain || hostnameFromHostHeader(domain) !== domain) {
        response.writeHead(400).end();
        return;
      }
      try {
        await refreshDomain(domain);
        response.writeHead(204).end();
      } catch (error) {
        console.error('Domain refresh failed:', error);
        response.writeHead(503).end();
      }
      return;
    }

    if (request.url === '/healthz') {
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('ok\n');
      return;
    }
    if ((request.method !== 'GET' && request.method !== 'HEAD')
        || (request.url !== '/' && !request.url?.startsWith('/?'))) {
      response.writeHead(404).end('Not found\n');
      return;
    }
    const hostname = hostnameFromHostHeader(request.headers.host);
    if (!hostname) {
      response.writeHead(400).end('Invalid Host\n');
      return;
    }
    const destinations = cache.get(hostname);
    if (!destinations) {
      response.writeHead(404).end('Unknown site\n');
      return;
    }
    response.writeHead(302, { Location: destinations[randomInt(destinations.length)] });
    response.end();
  });
  server.listen(port, '0.0.0.0', () => console.log(`Redirect server listening on port ${port}; ${cache.size} sites cached`));
}

if (require.main === module) start().catch((error) => {
  console.error('Redirect server startup failed:', error);
  process.exitCode = 1;
});

module.exports = { hostnameFromHostHeader, validDestination };
