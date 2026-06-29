'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NavAuth } from '@/components/auth/nav-auth';
import { useAuth } from '@/providers/auth-provider';
import { fetchJson } from '@/lib/api/fetch-json';
import { SUPERADMIN_ROLE } from '@/lib/auth/constants';

interface NavLink {
  href: string;
  label: string;
  match: (path: string) => boolean;
  superAdminOnly?: boolean;
}

interface ClientInfo {
  name?: string;
  version?: string;
}

const NAV_LINKS: NavLink[] = [
  { href: '/', label: '首页', match: (path) => path === '/' },
  { href: '/chat', label: '聊天', match: (path) => path === '/chat' || path.startsWith('/chat/') },
  { href: '/mcp', label: 'MCP服务', match: (path) => path === '/mcp' || path.startsWith('/mcp/') },
  {
    href: '/settings',
    label: '模型配置',
    match: (path) => path === '/settings' || path.startsWith('/settings/'),
  },
  {
    href: '/admin',
    label: '系统管理',
    match: (path) => path === '/admin' || path.startsWith('/admin/'),
    superAdminOnly: true,
  },
];

export function Navbar(): React.ReactElement {
  const pathname = usePathname();
  const { user, deviceSessions, openAuthModal, isLoading } = useAuth();
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);

  const isSuperAdmin = user?.role === SUPERADMIN_ROLE;

  useEffect(() => {
    void (async () => {
      try {
        const data = (await fetchJson('/api/client-info')) as ClientInfo;
        setClientInfo(data);
      } catch (error) {
        console.error('获取客户端信息时发生错误:', error);
      }
    })();
  }, []);

  return (
    <nav className="navbar">
      <div className="navbar__links">
        {NAV_LINKS.map((link) => {
          if (link.superAdminOnly && (isLoading || !isSuperAdmin)) {
            return null;
          }
          return (
            <Link
              key={link.href}
              href={link.href}
              className={link.match(pathname) ? 'navbar__link is-active' : 'navbar__link'}
              data-super-admin-only={link.superAdminOnly ? 'true' : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      <div className="navbar__right">
        <div
          id="client-info"
          className={`navbar__client${clientInfo?.name ? ' is-visible' : ''}`}
        >
          <svg
            className="navbar__client-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          {clientInfo?.name ? (
            <span id="client-name" className="navbar__client-name">
              {clientInfo.name}
            </span>
          ) : null}
          {clientInfo?.version ? (
            <span id="client-version" className="navbar__client-version">
              v{clientInfo.version}
            </span>
          ) : null}
        </div>

        <div id="navbar-auth" className="navbar__auth">
          <NavAuth
            user={user}
            deviceSessions={deviceSessions}
            onOpenAuthModal={openAuthModal}
          />
        </div>
      </div>
    </nav>
  );
}

export { SUPERADMIN_ROLE };
