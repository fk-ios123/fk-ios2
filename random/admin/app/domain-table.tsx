type DomainSummary = { domain: string; destinationCount: number };
type TargetFilter = 'all' | 'one' | 'multiple';

const pageSize = 10;

export default function DomainTable({ sites, queryInput, targetInput, pageInput }: {
  sites: DomainSummary[];
  queryInput?: string;
  targetInput?: string;
  pageInput?: string;
}) {
  const query = (queryInput || '').trim().slice(0, 200);
  const targetFilter: TargetFilter = targetInput === 'one' || targetInput === 'multiple' ? targetInput : 'all';
  const filtered = sites.filter((site) => {
    const matchesDomain = site.domain.toLowerCase().includes(query.toLowerCase());
    const matchesCount = targetFilter === 'all' || (targetFilter === 'one' ? site.destinationCount === 1 : site.destinationCount >= 2);
    return matchesDomain && matchesCount;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const parsedPage = Number(pageInput);
  const requestedPage = pageInput && Number.isSafeInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const currentPage = Math.min(requestedPage, pageCount);
  const start = (currentPage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  function listUrl(page: number) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (targetFilter !== 'all') params.set('targets', targetFilter);
    if (page > 1) params.set('page', String(page));
    const search = params.toString();
    return search ? `/?${search}` : '/';
  }

  function detailUrl(domain: string) {
    const context = listUrl(currentPage).split('?')[1];
    return `/domains/${encodeURIComponent(domain)}${context ? `?${context}` : ''}`;
  }

  return (
    <section className="overflow-hidden rounded-[22px] border border-[#e3ebe3] bg-white shadow-[0_3px_24px_rgba(24,53,45,0.045)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#edf1eb] px-6 py-5 sm:px-8">
        <div><div className="text-[10px] font-bold tracking-[0.18em] text-[#97a99b]">DOMAIN ROUTES</div><h2 className="mt-1 text-xl font-bold text-[#1d3a31]">域名配置</h2></div>
        <span className="text-xs text-[#7b8f80]">共 {sites.length} 个域名</span>
      </div>

      <form action="/" method="get" role="search" className="grid gap-3 border-b border-[#edf1eb] bg-[#fbfcfa] px-6 py-5 sm:grid-cols-[minmax(220px,1fr)_200px_auto] sm:items-end sm:px-8">
        <label className="grid gap-2 text-xs font-bold text-[#567164]">域名关键词
          <input type="search" name="q" defaultValue={query} placeholder="输入域名或其中一部分" className="input h-11 w-full border-[#dce7dd] bg-white font-mono text-sm font-normal focus:border-[#2b8b64] focus:outline-none" />
        </label>
        <label className="grid gap-2 text-xs font-bold text-[#567164]">跳转地址数量
          <select name="targets" defaultValue={targetFilter} className="select h-11 w-full border-[#dce7dd] bg-white text-sm font-normal focus:border-[#2b8b64] focus:outline-none">
            <option value="all">全部</option><option value="one">1 条</option><option value="multiple">2 条及以上</option>
          </select>
        </label>
        <div className="flex gap-2"><button type="submit" className="btn h-11 flex-1 border-0 bg-[#1e684e] px-6 text-white shadow-none hover:bg-[#16553f] sm:flex-none">查询</button><a href="/" className="btn h-11 flex-1 border-[#dce7dd] bg-white px-5 text-[#557363] shadow-none hover:bg-[#f1f7ef] sm:flex-none">重置</a></div>
      </form>

      <div className="overflow-x-auto">
        <table className="table min-w-[660px] w-full" aria-label="域名配置列表">
          <thead className="bg-[#f5f8f3] text-xs text-[#789082]"><tr><th className="w-[48%] px-6 py-4 font-semibold sm:px-8">域名</th><th className="px-4 py-4 font-semibold">跳转目标</th><th className="px-4 py-4 font-semibold">状态</th><th className="px-6 py-4 text-right font-semibold sm:px-8">操作</th></tr></thead>
          <tbody>
            {visible.map((site) => <tr key={site.domain} className="border-t border-[#edf1eb] hover:bg-[#fafcf9]">
              <td className="px-6 py-4 sm:px-8"><a href={detailUrl(site.domain)} className="flex min-w-0 items-center gap-3 hover:text-[#1e684e]"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#edf2eb] text-sm text-[#648070]">↗</span><span className="min-w-0 break-all font-mono text-sm font-semibold" title={site.domain}>{site.domain}</span></a></td>
              <td className="px-4 py-4"><span className="rounded-full bg-[#eff5ed] px-3 py-1.5 text-xs font-semibold text-[#426f53]">{site.destinationCount} 条地址</span></td>
              <td className="px-4 py-4"><span className="inline-flex items-center gap-2 text-xs font-semibold text-[#328159]"><span className="size-1.5 rounded-full bg-[#3baa75]" /> 已配置</span></td>
              <td className="px-6 py-4 text-right sm:px-8"><a href={detailUrl(site.domain)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-[#1e684e] hover:bg-[#e7f2e5]">管理地址 <span aria-hidden="true">↗</span></a></td>
            </tr>)}
            {visible.length === 0 && <tr><td colSpan={4} className="px-6 py-14 text-center"><p className="text-sm font-semibold text-[#4f6a58]">没有找到匹配的域名</p><p className="mt-1 text-xs text-[#92a197]">调整关键词或跳转地址数量后重新查询</p></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1eb] px-6 py-4 sm:px-8">
        <span className="text-xs text-[#819389]">显示 {filtered.length ? `${start + 1}–${Math.min(start + pageSize, filtered.length)}` : '0'} 项，共 {filtered.length} 项</span>
        <div className="flex items-center gap-3"><span className="font-mono text-xs text-[#819389]">{currentPage} / {pageCount}</span>{currentPage > 1 ? <a href={listUrl(currentPage - 1)} aria-label="上一页" className="btn btn-sm border-[#dce7dd] bg-white text-[#426c51] shadow-none">‹</a> : <span aria-label="上一页不可用" className="btn btn-sm btn-disabled">‹</span>}{currentPage < pageCount ? <a href={listUrl(currentPage + 1)} aria-label="下一页" className="btn btn-sm border-[#dce7dd] bg-white text-[#426c51] shadow-none">›</a> : <span aria-label="下一页不可用" className="btn btn-sm btn-disabled">›</span>}</div>
      </div>
    </section>
  );
}
