import { domainToASCII } from 'node:url';
import { MongoClient, type Collection } from 'mongodb';

type SiteDocument = { _id: string; destinations: string[]; version: number };
let clientPromise: Promise<MongoClient> | undefined;

function collection(): Promise<Collection<SiteDocument>> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI 未配置');
  clientPromise ??= new MongoClient(uri, { serverSelectionTimeoutMS: 5000 }).connect().catch((error: unknown) => {
    clientPromise = undefined;
    throw error;
  });
  return clientPromise.then((client) => client.db(process.env.MONGODB_DATABASE || 'random_redirect').collection<SiteDocument>('sites'));
}

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

export async function readSite(domain: string): Promise<Site> {
  const normalized = normalizeDomain(domain);
  const site = await (await collection()).findOne({ _id: normalized });
  if (!site) throw Object.assign(new Error('域名不存在'), { code: 'ENOENT' });
  return { domain: normalized, destinations: site.destinations, version: String(site.version) };
}

export async function listSites(): Promise<Site[]> {
  const sites = await (await collection()).find({}, { projection: { _id: 1, destinations: 1, version: 1 } }).sort({ _id: 1 }).toArray();
  return sites.map((site) => ({ domain: site._id, destinations: site.destinations, version: String(site.version) }));
}

export async function createSite(domainInput: unknown, destinationsInput: unknown): Promise<string> {
  const domain = normalizeDomain(domainInput);
  const destinations = parseDestinations(destinationsInput);
  try {
    await (await collection()).insertOne({ _id: domain, destinations, version: 1 });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw Object.assign(new Error('域名已存在'), { code: 'EEXIST' });
    throw error;
  }
  return domain;
}

export async function updateSite(domainInput: unknown, destinationsInput: unknown, expectedVersion: unknown): Promise<string> {
  const domain = normalizeDomain(domainInput);
  const destinations = parseDestinations(destinationsInput);
  const version = Number(expectedVersion);
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('配置版本错误，请刷新后重试');
  const result = await (await collection()).updateOne({ _id: domain, version }, { $set: { destinations }, $inc: { version: 1 } });
  if (!result.matchedCount) throw new Error('配置已被其他人修改，请刷新后重试');
  return domain;
}

export async function notifyWeb(domain: string): Promise<boolean> {
  const baseUrl = process.env.WEB_RELOAD_URL;
  const token = process.env.WEB_RELOAD_TOKEN;
  if (!baseUrl || !token) return false;
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('domain', normalizeDomain(domain));
    const response = await fetch(url, { method: 'POST', headers: { 'x-reload-token': token }, signal: AbortSignal.timeout(3000) });
    return response.status === 204;
  } catch (error) {
    console.error('Web cache refresh notification failed:', error);
    return false;
  }
}
