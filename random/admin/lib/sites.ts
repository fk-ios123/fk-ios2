import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { domainToASCII } from 'node:url';

const root = process.env.DESTINATIONS_DIR || '/data/domains';

export type Site = { domain: string; destinations: string[]; version: string };

export function normalizeDomain(value: unknown): string {
  if (typeof value !== 'string') throw new Error('请输入域名');
  const domain = domainToASCII(value.trim().toLowerCase());
  if (!domain || domain.length > 253 || !domain.includes('.') ||
      !domain.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error('请输入有效域名，不要包含协议或端口');
  }
  return domain;
}

export function parseDestinations(value: unknown): string[] {
  const urls = String(value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (urls.length < 1 || urls.length > 20) throw new Error('每个域名需要 1 到 20 个地址');
  if (new Set(urls).size !== urls.length) throw new Error('跳转地址不能重复');
  for (const value of urls) {
    if (/\s|[\x00-\x1f\x7f]/.test(value) || !/^https?:\/\//i.test(value)) {
      throw new Error(`地址格式错误：${value}`);
    }
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw new Error();
    } catch {
      throw new Error(`地址格式错误：${value}`);
    }
  }
  return urls;
}

function configPath(domain: string): string {
  return join(root, normalizeDomain(domain), 'destinations.json');
}

export async function readSite(domain: string): Promise<Site> {
  const contents = await readFile(configPath(domain), 'utf8');
  const parsed: unknown = JSON.parse(contents);
  if (!parsed || typeof parsed !== 'object' || !('destinations' in parsed) ||
      !Array.isArray(parsed.destinations) || !parsed.destinations.every((value) => typeof value === 'string')) {
    throw new Error('配置格式错误');
  }
  return { domain, destinations: parsed.destinations, version: createHash('sha256').update(contents).digest('hex') };
}

export async function listSites(): Promise<Site[]> {
  await mkdir(root, { recursive: true });
  const entries = await readdir(root, { withFileTypes: true });
  const domains = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const sites: Site[] = [];
  for (const domain of domains) {
    try {
      sites.push(await readSite(domain));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return sites;
}

async function writeAtomic(path: string, document: { destinations: string[] }): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const file = await open(temporary, 'wx', 0o644);
    try {
      await file.writeFile(JSON.stringify(document, null, 2) + '\n');
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function createSite(domainInput: unknown, destinationsInput: unknown): Promise<string> {
  const domain = normalizeDomain(domainInput);
  const destinations = parseDestinations(destinationsInput);
  await mkdir(root, { recursive: true });
  const directory = join(root, domain);
  await mkdir(directory);
  try {
    await writeAtomic(configPath(domain), { destinations });
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return domain;
}

export async function updateSite(domainInput: unknown, destinationsInput: unknown, expectedVersion: unknown): Promise<string> {
  const domain = normalizeDomain(domainInput);
  const destinations = parseDestinations(destinationsInput);
  const current = await readSite(domain);
  if (current.version !== expectedVersion) throw new Error('配置已被其他人修改，请刷新后重试');
  await writeAtomic(configPath(domain), { destinations });
  return domain;
}
