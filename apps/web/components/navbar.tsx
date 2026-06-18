'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SUPERADMIN_ROLE = 'SUPERADMIN';

interface NavLink {
  href: string;
  label: string;
  match: (path: string) => boolean;
  superAdminOnly?: boolean;
}

const NAV_LINKS: NavLink[] = [
  { href: '/', label: '首页', match: (path) => path === '/' },
  { href: '/ai', label: 'AI聊天', match: (path) => path === '/ai' || path.startsWith('/ai/') },
  { href: '/info', label: 'MCP服务', match: (path) => path === '/info' || path.startsWith('/info/') },
  {
    href: '/settings',
    label: '配置管理',
    match: (path) => path === '/settings' || path.startsWith('/settings/'),
  },
  {
    href: '/admin',
    label: '高级配置',
    match: (path) => path === '/admin' || path.startsWith('/admin/'),
    superAdminOnly: true,
  },
];

export function Navbar(): React.ReactElement {
  const pathname = usePathname();

  return (
    <nav className="navbar">
      <div className="navbar__links">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={link.match(pathname) ? 'navbar__link is-active' : 'navbar__link'}
            data-super-admin-only={link.superAdminOnly ? 'true' : undefined}
            hidden={link.superAdminOnly ? true : undefined}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <div className="navbar__right">
        <span style={{ fontSize: 13, opacity: 0.85 }}>Meek</span>
      </div>
    </nav>
  );
}

export { SUPERADMIN_ROLE };
