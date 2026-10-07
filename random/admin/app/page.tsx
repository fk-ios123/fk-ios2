import { redirect } from 'next/navigation';
import { requireAuth } from '../lib/auth';
import { listSites } from '../lib/sites';
import AdminShell from './admin-shell';
import CreateDomainDialog from './create-domain-dialog';
import DomainTable from './domain-table';

export const dynamic = 'force-dynamic';

type SearchParams = { site?: string; error?: string; notice?: string; q?: string; targets?: string; page?: string };

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAuth();
  const params = await searchParams;
  if (typeof params.site === 'string' && params.site) {
    const context = new URLSearchParams();
    if (typeof params.q === 'string') context.set('q', params.q);
    if (typeof params.targets === 'string') context.set('targets', params.targets);
    if (typeof params.page === 'string') context.set('page', params.page);
    const search = context.toString();
    redirect(`/domains/${encodeURIComponent(params.site)}${search ? `?${search}` : ''}`);
  }
  const sites = await listSites();
  const totalDestinations = sites.reduce((count, site) => count + site.destinations.length, 0);

  return (
    <AdminShell>
      <header className="mb-9 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-[#6d8a7a]"><span className="size-1.5 rounded-full bg-[#2b9d70]" /> 工作空间 <span className="text-[#b1c0b5]">/</span> 域名路由</div>
          <h1 className="text-3xl font-bold tracking-tight text-[#18352d] sm:text-4xl">管理每一个入口<span className="text-[#2c8b67]">.</span></h1>
          <p className="mt-3 text-sm leading-6 text-[#73877b]">查找域名，进入专属页面管理跳转地址。</p>
        </div>
        <div className="flex flex-wrap items-center gap-3"><span className="inline-flex items-center gap-2 rounded-full border border-[#cfe6d4] bg-[#ecf8ee] px-4 py-2 text-xs font-bold text-[#267353]"><span className="size-2 rounded-full bg-[#31a877]" /> 配置服务运行中</span><CreateDomainDialog placement="header" /></div>
      </header>

      {params.error && <div role="alert" className="alert alert-error mb-6 rounded-xl text-sm">{params.error}</div>}
      {params.notice && <div role="status" className="alert alert-success mb-6 rounded-xl text-sm">{params.notice === 'created' ? '域名已创建' : '配置已保存'}</div>}

      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e4ebe4] bg-white px-6 py-5 shadow-[0_2px_16px_rgba(24,53,45,0.035)]"><div className="text-xs font-semibold tracking-wider text-[#82958a]">已配置域名</div><div className="mt-2 text-3xl font-bold tracking-tight text-[#18352d]">{sites.length.toString().padStart(2, '0')}<span className="ml-2 text-sm font-medium text-[#91a198]">个</span></div></div>
        <div className="rounded-2xl border border-[#e4ebe4] bg-white px-6 py-5 shadow-[0_2px_16px_rgba(24,53,45,0.035)]"><div className="text-xs font-semibold tracking-wider text-[#82958a]">跳转目标</div><div className="mt-2 text-3xl font-bold tracking-tight text-[#18352d]">{totalDestinations.toString().padStart(2, '0')}<span className="ml-2 text-sm font-medium text-[#91a198]">条</span></div></div>
        <div className="rounded-2xl border border-[#dbe9da] bg-[#eaf4e8] px-6 py-5"><div className="text-xs font-semibold tracking-wider text-[#557b63]">配置方式</div><div className="mt-3 text-base font-bold text-[#225b45]">每域名独立管理 <span aria-hidden="true">↗</span></div></div>
      </div>

      <DomainTable sites={sites.map((site) => ({ domain: site.domain, destinationCount: site.destinations.length }))}
        queryInput={typeof params.q === 'string' ? params.q : undefined} targetInput={typeof params.targets === 'string' ? params.targets : undefined} pageInput={typeof params.page === 'string' ? params.page : undefined} />
    </AdminShell>
  );
}
