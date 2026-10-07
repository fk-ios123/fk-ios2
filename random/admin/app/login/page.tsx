import { redirect } from 'next/navigation';
import { login } from '../actions';
import { isAuthenticated } from '../../lib/auth';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAuthenticated()) redirect('/');
  const params = await searchParams;
  return (
    <main className="grid min-h-screen bg-[#f5f7f4] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="relative hidden min-h-screen flex-col overflow-hidden bg-[#132d29] p-12 text-white lg:flex xl:p-16">
        <div className="relative z-10 flex items-center gap-3"><span className="flex size-12 items-center justify-center rounded-2xl bg-[#d5ef8b] text-2xl font-black text-[#17382b]">↗</span><span><span className="block text-[11px] font-bold tracking-[0.22em] text-[#a8c7b9]">ROUTE STUDIO</span><span className="text-xl font-bold">跳转控制台</span></span></div>
        <div className="relative z-10 my-auto max-w-lg"><div className="mb-7 h-1 w-14 rounded-full bg-[#d5ef8b]" /><h1 className="text-5xl font-bold leading-[1.25] tracking-tight xl:text-6xl">让每一个域名<br />去往正确的地方<span className="text-[#d5ef8b]">.</span></h1><p className="mt-7 max-w-md text-base leading-8 text-[#a8c7b9]">统一管理域名入口与跳转目标。配置清楚，变更即时，运营更轻松。</p></div>
        <div className="relative z-10 flex items-center gap-2 border-t border-white/15 pt-7 text-xs tracking-wide text-[#8da99b]"><span className="size-2 rounded-full bg-[#bde47e]" /> REDIRECT MANAGEMENT</div>
        <div className="pointer-events-none absolute -right-36 bottom-[-12rem] size-[36rem] rounded-full border-[80px] border-white/5" />
        <div className="pointer-events-none absolute -right-20 bottom-[-7rem] size-[22rem] rounded-full border-[2px] border-[#d5ef8b]/20" />
      </section>
      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <div className="mb-12 flex items-center gap-3 lg:hidden"><span className="flex size-11 items-center justify-center rounded-2xl bg-[#d5ef8b] text-xl font-black text-[#17382b]">↗</span><span className="font-bold text-[#17382b]">跳转控制台</span></div>
          <div className="mb-3 text-xs font-bold tracking-[0.2em] text-[#2e8a67]">WELCOME BACK</div>
          <h2 className="text-4xl font-bold tracking-tight text-[#1b382f]">欢迎回来</h2>
          <p className="mt-3 text-sm leading-7 text-[#7e9183]">登录运营账号，继续管理域名与跳转地址。</p>
          {params.error && <div role="alert" className="alert alert-error mt-8 rounded-xl text-sm">账号或密码不正确</div>}
          <form action={login} className="mt-10 grid gap-6">
            <label className="grid gap-2 text-sm font-bold text-[#315447]">账号<input name="username" autoComplete="username" required placeholder="输入运营账号" className="input h-13 w-full border-[#dbe6db] bg-white px-4 text-sm focus:border-[#2b8b64] focus:outline-none" /></label>
            <label className="grid gap-2 text-sm font-bold text-[#315447]">密码<input name="password" type="password" autoComplete="current-password" required placeholder="输入密码" className="input h-13 w-full border-[#dbe6db] bg-white px-4 text-sm focus:border-[#2b8b64] focus:outline-none" /></label>
            <button type="submit" className="btn mt-2 h-13 border-0 bg-[#1e684e] text-white shadow-none hover:bg-[#16553f]">登录控制台 <span aria-hidden="true">↗</span></button>
          </form>
          <p className="mt-10 text-xs leading-6 text-[#9baa9e]">仅授权运营人员可访问。请妥善保管账号和密码。</p>
        </div>
      </section>
    </main>
  );
}
