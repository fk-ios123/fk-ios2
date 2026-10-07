import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = { title: '跳转域名管理' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-CN" data-theme="route"><body className="min-h-screen bg-base-200 font-sans text-base-content">{children}</body></html>;
}
