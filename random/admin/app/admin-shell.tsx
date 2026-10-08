import type { ReactNode } from 'react';
import { logout } from './actions';
import CreateDomainDialog from './create-domain-dialog';

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f7f4] lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="flex flex-wrap items-center bg-[#132d29] px-6 py-7 text-white lg:sticky lg:top-0 lg:h-screen lg:flex-col lg:items-stretch lg:px-7 lg:py-9">
        <a href="/" className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#d5ef8b] text-xl font-black text-[#17382b]">↗</div>
          <div><div className="text-[11px] font-bold tracking-[0.22em] text-[#a8c7b9]">ROUTE STUDIO</div><div className="text-lg font-bold tracking-tight">跳转控制台</div></div>
        </a>
        <div className="mt-11 hidden lg:block">
          <div className="mb-3 px-3 text-[11px] font-bold tracking-[0.18em] text-[#8ea99e]">工作空间</div>
          <a href="/" className="flex items-center gap-3 rounded-xl bg-white/12 px-4 py-3 text-sm font-semibold"><span className="text-[#d5ef8b]">◈</span> 域名路由 <span className="ml-auto text-[#d5ef8b]">●</span></a>
          <CreateDomainDialog placement="sidebar" />
        </div>
        <div className="mt-auto hidden border-t border-white/12 pt-6 lg:block">
          <p className="text-xs leading-6 text-[#a7c0b5]">每个域名独立配置跳转目标。保存后，Web 缓存会同步更新。</p>
          <form action={logout} className="mt-6"><button type="submit" className="btn btn-ghost w-full justify-start border-white/15 text-[#dcebe1] hover:bg-white/10">退出登录 <span className="ml-auto">↗</span></button></form>
        </div>
        <form action={logout} className="ml-auto lg:hidden"><button type="submit" className="btn btn-ghost btn-sm text-white">退出登录</button></form>
      </aside>
      <main className="min-w-0 px-4 py-7 sm:px-8 lg:px-10 lg:py-10 xl:px-14">
        <div className="mx-auto max-w-[1360px]">{children}</div>
      </main>
    </div>
  );
}
