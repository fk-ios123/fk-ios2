'use client';

import { useRef, useState } from 'react';

type Destination = { id: number; value: string };

export default function DestinationFields({ initial = [''], compact = false }: { initial?: string[]; compact?: boolean }) {
  const nextId = useRef(initial.length);
  const [items, setItems] = useState<Destination[]>(initial.map((value, id) => ({ id, value })));

  function update(id: number, value: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, value } : item));
  }

  function add() {
    if (items.length >= 20) return;
    setItems((current) => [...current, { id: nextId.current++, value: '' }]);
  }

  function remove(id: number) {
    if (items.length <= 1) return;
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="destinations" value={items.map((item) => item.value.trim()).join('\n')} />
      {items.map((item, index) => (
        <div key={item.id} className="group flex items-center gap-3 rounded-2xl border border-[#e0e7e1] bg-white p-2.5 shadow-[0_2px_10px_rgba(19,48,39,0.03)] transition-colors focus-within:border-[#24846a] focus-within:ring-4 focus-within:ring-[#24846a]/10">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#e8f1eb] font-mono text-xs font-bold text-[#27745e]">{String(index + 1).padStart(2, '0')}</span>
          <input
            aria-label={`跳转地址 ${index + 1}`}
            value={item.value}
            onChange={(event) => update(item.id, event.target.value)}
            inputMode="url"
            placeholder={compact ? 'https://example.com/path' : 'https://destination.example.com/path'}
            required
            className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 font-mono text-sm text-[#183630] outline-none placeholder:text-[#9aa9a0]"
          />
          <button type="button" onClick={() => remove(item.id)} disabled={items.length === 1} aria-label={`移除跳转地址 ${index + 1}`}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[#899b90] transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30">×</button>
        </div>
      ))}
      <button type="button" onClick={add} disabled={items.length >= 20}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#bbd1c3] bg-[#f4faf5] px-4 py-3 text-sm font-semibold text-[#23634e] transition-colors hover:border-[#2d8b68] hover:bg-[#eaf5ed] disabled:cursor-not-allowed disabled:opacity-50">
        <span className="text-lg leading-none">+</span> 添加一个跳转地址
      </button>
      <p className="text-xs text-[#87948b]">已配置 {items.length}/20 个地址 · 系统将随机选择一个目标</p>
    </div>
  );
}
