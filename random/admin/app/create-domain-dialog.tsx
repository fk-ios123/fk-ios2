'use client';

import { useRef } from 'react';
import { addDomain } from './actions';
import DestinationFields from './destination-fields';

export default function CreateDomainDialog({ placement }: { placement: 'header' | 'sidebar' }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()}
        className={placement === 'sidebar'
          ? 'mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#d5ef8b] px-4 py-3 text-sm font-bold text-[#18382c] transition-colors hover:bg-[#e2f7a6]'
          : 'flex items-center gap-2 rounded-xl bg-[#1e684e] px-5 py-3 text-sm font-bold text-white shadow-[0_6px_16px_rgba(30,104,78,0.16)] transition-colors hover:bg-[#16553f]'}>
        <span aria-hidden="true" className="text-lg leading-none">+</span> 新增域名
      </button>
      <dialog ref={dialog} aria-labelledby={`create-domain-title-${placement}`} onClick={(event) => {
        if (event.target === dialog.current) dialog.current?.close();
      }} className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-[24px] border border-[#e2ebe2] bg-white p-0 text-[#18352d] shadow-[0_24px_90px_rgba(10,30,23,0.24)] backdrop:bg-[#102720]/65 backdrop:backdrop-blur-[3px]">
        <div className="flex items-start justify-between border-b border-[#edf1eb] px-6 py-5 sm:px-8">
          <div><div className="mb-2 text-[10px] font-bold tracking-[0.18em] text-[#718d7b]">CREATE ROUTE / 新建入口</div><h2 id={`create-domain-title-${placement}`} className="text-2xl font-bold">新增域名</h2><p className="mt-2 text-sm text-[#829489]">为新的域名配置独立的跳转地址。</p></div>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="关闭新增域名窗口" className="flex size-9 items-center justify-center rounded-xl bg-[#f2f5f1] text-xl text-[#667d6e] hover:bg-[#e5ebe3]">×</button>
        </div>
        <form action={addDomain} className="grid max-h-[min(70vh,700px)] gap-5 overflow-y-auto px-6 py-6 sm:px-8">
          <label className="grid gap-2 text-sm font-bold text-[#27463b]">域名<input name="domain" placeholder="go.example.com" autoComplete="off" required className="input h-12 w-full border-[#dce7dd] bg-white font-mono text-sm focus:border-[#2b8b64] focus:outline-none" /></label>
          <div><h3 className="mb-3 text-sm font-bold text-[#27463b]">跳转地址</h3><DestinationFields compact /></div>
          <p className="rounded-xl bg-[#f3f7ef] px-4 py-3 text-xs leading-6 text-[#6f8774]">创建后还需在 DNS / ESA 中配置域名解析和 HTTP 80 回源。</p>
          <div className="flex justify-end gap-3 border-t border-[#edf1eb] pt-5"><button type="button" onClick={() => dialog.current?.close()} className="btn btn-ghost">取消</button><button type="submit" className="btn border-0 bg-[#1e684e] px-7 text-white shadow-none hover:bg-[#16553f]">创建域名 <span aria-hidden="true">↗</span></button></div>
        </form>
      </dialog>
    </>
  );
}
