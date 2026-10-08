import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const output = process.argv[2];
if (!output) {
  console.error('Usage: node scripts/init-mongo-env.mjs <mongo.env>');
  process.exit(2);
}

const username = 'random_admin';
const password = randomBytes(32).toString('hex');
const reloadToken = randomBytes(32).toString('hex');
const content = [
  `MONGO_INITDB_ROOT_USERNAME=${username}`,
  `MONGO_INITDB_ROOT_PASSWORD=${password}`,
  `MONGODB_URI=mongodb://${username}:${password}@mongo:27017/random_redirect?authSource=admin`,
  'MONGODB_DATABASE=random_redirect',
  `WEB_RELOAD_TOKEN=${reloadToken}`,
  '',
].join('\n');
await writeFile(output, content, { flag: 'wx', mode: 0o600 });
console.log(`MongoDB credentials written to ${output}`);
