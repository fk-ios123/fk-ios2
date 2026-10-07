import { notFound } from 'next/navigation';
import { requireAuth } from '../../../lib/auth';
import { normalizeDomain, readSite } from '../../../lib/sites';
import { saveDomain } from '../../actions';
import AdminShell from '../../admin-shell';
import DestinationFields from '../../destination-fields';

export const dynamic = 'force-dynamic';

type DetailQuery = { q?: string; targets?: string; page?: string; error?: string; notice?: string };

export default async function DomainPage({ params, searchParams }: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<DetailQuery>;
}) {
  await requireAuth();
  const [{ domain: domainInput }, query] = await Promise.all([params, searchParams]);
  let domain: string;
  try {
    domain = normalizeDomain(domainInput);
  } catch {
    notFound();
  }
  let site;
  try {
    site = await readSite(domain);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') notFound();
    throw error;
  }
  const context = new URLSearchParams();
  if (typeof query.q === 'string' && query.q.trim()) context.set('q', query.q.trim().slice(0, 200));
  if (query.targets === 'one' || query.targets === 'multiple') context.set('targets', query.targets);
  if (typeof query.page === 'string' && /^[1-9]\d{0,5}$/.test(query.page)) context.set('page', query.page);
  const backHref = context.size ? `/?${context.toString()}` : '/';

  return (
    <AdminShell>
      <nav aria-label="面包屑导航" className="mb-6 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#799181]">
        <a href={backHref} className="hover:text-[#1e684e]">域名路由</a><span className="text-[#b1c3b3]">/</span><span className="break-all text-[#2d6047]">{domain}</span>
      </nav>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div><div className="mb-2 text-xs font-bold tracking-[0.18em] text-[#6a957a]">DOMAIN SETTINGS</div><h1 className="break-all font-mono text-3xl font-bold tracking-tight text-[#18352d] sm:text-4xl">{domain}</h1><p className="mt-3 text-sm leading-6 text-[#73877b]">管理此域名的跳转目标。保存后，新请求会立即读取最新配置。</p></div>
        <a href={backHref} className="btn border-[#dce7dd] bg-white px-5 text-[#326448] shadow-none hover:bg-[#f0f7ee]">← 返回域名列表</a>
      </header>

      {query.error && <div role="alert" className="alert alert-error mb-6 rounded-xl text-sm">{query.error}</div>}
      {query.notice && <div role="status" className="alert alert-success mb-6 rounded-xl text-sm">{query.notice === 'created' ? '域名已创建，可继续配置跳转地址' : '跳转地址已保存'}</div>}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e4ebe4] bg-white px-6 py-5"><div className="text-xs font-semibold text-[#82958a]">跳转地址</div><div className="mt-2 text-3xl font-bold text-[#18352d]">{site.destinations.length.toString().padStart(2, '0')}<span className="ml-2 text-sm font-medium text-[#91a198]">条</span></div></div>
        <div className="rounded-2xl border border-[#e4ebe4] bg-white px-6 py-5"><div className="text-xs font-semibold text-[#82958a]">选择方式</div><div className="mt-3 font-bold text-[#245a42]">随机跳转</div></div>
        <div className="rounded-2xl border border-[#dbe9da] bg-[#eaf4e8] px-6 py-5"><div className="text-xs font-semibold text-[#557b63]">配置状态</div><div className="mt-3 flex items-center gap-2 font-bold text-[#225b45]"><span className="size-2 rounded-full bg-[#39aa76]" /> 已启用</div></div>
      </div>

      <section className="max-w-5xl overflow-hidden rounded-[22px] border border-[#e3ebe3] bg-white shadow-[0_3px_24px_rgba(24,53,45,0.045)]">
        <div className="border-b border-[#edf1eb] px-6 py-6 sm:px-8"><div className="text-[10px] font-bold tracking-[0.18em] text-[#718d7b]">DESTINATIONS / 地址管理</div><h2 className="mt-2 text-xl font-bold text-[#17392e]">跳转地址</h2><p className="mt-2 text-sm text-[#84948a]">可添加 1–20 条 HTTP 或 HTTPS 地址，访问时随机选择一条。</p></div>
        <form action={saveDomain} className="px-6 py-6 sm:px-8">
          <input type="hidden" name="domain" value={domain} /><input type="hidden" name="version" value={site.version} />
          <input type="hidden" name="q" value={context.get('q') || ''} /><input type="hidden" name="targets" value={context.get('targets') || ''} /><input type="hidden" name="page" value={context.get('page') || ''} />
          <DestinationFields initial={site.destinations} />
          <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-[#edf1eb] pt-6"><span className="text-xs text-[#87978b]">保存后立即生效</span><button type="submit" className="btn border-0 bg-[#1e684e] px-7 text-white shadow-none hover:bg-[#16553f]">保存跳转地址 <span aria-hidden="true">↗</span></button></div>
        </form>
      </section>
    </AdminShell>
  );
}
