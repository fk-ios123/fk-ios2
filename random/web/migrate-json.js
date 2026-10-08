const { readdir, readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { MongoClient } = require('mongodb');
const { hostnameFromHostHeader, validDestination } = require('./server');

async function main() {
  const directory = process.argv[2];
  if (!directory || !process.env.MONGODB_URI) throw new Error('Usage: node migrate-json.js <legacy-domains-directory> (MONGODB_URI required)');
  const entries = await readdir(directory, { withFileTypes: true });
  const sites = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const domain = entry.name.toLowerCase();
    if (domain !== entry.name || hostnameFromHostHeader(domain) !== domain) throw new Error(`Invalid domain: ${entry.name}`);
    const raw = await readFile(join(directory, domain, 'destinations.json'), 'utf8');
    const destinations = JSON.parse(raw).destinations;
    if (!Array.isArray(destinations) || destinations.length < 1 || destinations.length > 20
        || !destinations.every(validDestination)) throw new Error(`Invalid destinations: ${domain}`);
    sites.push({ _id: domain, destinations, version: 1 });
  }

  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const collection = client.db(process.env.MONGODB_DATABASE || 'random_redirect').collection('sites');
    let inserted = 0;
    for (const site of sites) {
      const result = await collection.updateOne({ _id: site._id }, { $setOnInsert: site }, { upsert: true });
      if (result.upsertedCount) inserted++;
    }
    console.log(`Validated ${sites.length} legacy sites; inserted ${inserted}; already present ${sites.length - inserted}. JSON files were retained.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
