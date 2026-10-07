import { randomBytes, scryptSync } from 'node:crypto';
import { writeFile, rm } from 'node:fs/promises';

const [envPath, passwordPath] = process.argv.slice(2);
if (!envPath || !passwordPath) {
  console.error('Usage: node scripts/init-credentials.mjs <admin.env> <password-file>');
  process.exit(2);
}

const username = 'operator';
const password = randomBytes(24).toString('base64url');
const salt = randomBytes(16).toString('hex');
const hash = scryptSync(password, salt, 32).toString('hex');
const secret = randomBytes(48).toString('hex');
const env = `ADMIN_USERNAME=${username}\nADMIN_PASSWORD_SCRYPT=${salt}:${hash}\nADMIN_SESSION_SECRET=${secret}\n`;

await writeFile(envPath, env, { flag: 'wx', mode: 0o600 });
try {
  await writeFile(passwordPath, `username: ${username}\npassword: ${password}\n`, { flag: 'wx', mode: 0o600 });
} catch (error) {
  await rm(envPath, { force: true });
  throw error;
}
console.log(`Credentials created in ${envPath} and ${passwordPath}`);
