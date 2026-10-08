'use server';

import { redirect } from 'next/navigation';
import { checkPassword, clearSession, createSession, requireAuth } from '../lib/auth';
import { createSite, notifyWeb, updateSite } from '../lib/sites';

export async function login(formData: FormData): Promise<void> {
  const username = String(formData.get('username') || '');
  const password = String(formData.get('password') || '');
  if (!checkPassword(username, password)) redirect('/login?error=invalid');
  await createSession();
  redirect('/');
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect('/login');
}

export async function addDomain(formData: FormData): Promise<void> {
  await requireAuth();
  let domain = '';
  let error;
  let refreshed = false;
  try {
    domain = await createSite(formData.get('domain'), formData.get('destinations'));
    refreshed = await notifyWeb(domain);
  } catch (cause) {
    error = (cause as NodeJS.ErrnoException).code === 'EEXIST' ? '域名已存在' : (cause as Error).message;
  }
  if (error) redirect(`/?error=${encodeURIComponent(error)}`);
  redirect(`/domains/${encodeURIComponent(domain)}?notice=${refreshed ? 'created' : 'pending'}`);
}

export async function saveDomain(formData: FormData): Promise<void> {
  await requireAuth();
  const domain = String(formData.get('domain') || '');
  const params = new URLSearchParams();
  const query = String(formData.get('q') || '').trim().slice(0, 200);
  const targets = String(formData.get('targets') || '');
  const page = String(formData.get('page') || '');
  if (query) params.set('q', query);
  if (targets === 'one' || targets === 'multiple') params.set('targets', targets);
  if (/^[1-9]\d{0,5}$/.test(page)) params.set('page', page);
  let error;
  let refreshed = false;
  try {
    await updateSite(domain, formData.get('destinations'), formData.get('version'));
    refreshed = await notifyWeb(domain);
  } catch (cause) {
    error = (cause as Error).message;
  }
  if (error) params.set('error', error);
  else params.set('notice', refreshed ? 'saved' : 'pending');
  redirect(`/domains/${encodeURIComponent(domain)}?${params.toString()}`);
}
