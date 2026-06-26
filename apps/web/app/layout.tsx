import type { ReactNode } from 'react';
import { Navbar } from '@/components/navbar';
import { UiRoot } from '@/components/ui/ui-root';
import { AuthProvider } from '@/providers/auth-provider';
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
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="has-navbar" suppressHydrationWarning>
        <AuthProvider>
          <Navbar />
          {children}
          <UiRoot />
        </AuthProvider>
      </body>
    </html>
  );
}
