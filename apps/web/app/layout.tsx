import type { ReactNode } from 'react';
import { Navbar } from '@/components/navbar';
import './globals.css';

export const metadata = {
  title: 'Meek',
  description: 'MCP Agent Client — Next.js + Worker',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <html lang="zh-CN">
      <body className="has-navbar">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
