'use client';

import { useEffect, useRef, useState } from 'react';
import {
  displayAuthName,
  setActiveSession,
  signOut,
  type AuthUser,
  type DeviceSession,
} from '@/lib/auth/session';
import { SUPERADMIN_ROLE } from '@/lib/auth/constants';
import { cn } from '@/lib/utils/cn';

const MAX_DEVICE_SESSIONS = 3;

const BTN_GHOST =
  'inline-flex h-[30px] w-[30px] items-center justify-center rounded-full border border-white/40 bg-transparent text-white transition hover:bg-white/15 [&_svg]:h-4 [&_svg]:w-4';

function pickRecentSessions(
  sessions: DeviceSession[],
  currentUserId: string,
): DeviceSession[] {
  const unique: DeviceSession[] = [];
  const seen = new Set<string>();
  for (const entry of sessions) {
    const userId = entry.user?.id;
    if (!userId || seen.has(userId)) {
      continue;
    }
    seen.add(userId);
    unique.push(entry);
  }
  unique.sort((a, b) => {
    if (a.user.id === currentUserId) {
      return -1;
    }
    if (b.user.id === currentUserId) {
      return 1;
    }
    return 0;
  });
  return unique.slice(0, MAX_DEVICE_SESSIONS);
}

export interface NavAuthProps {
  user: AuthUser | null;
  deviceSessions: DeviceSession[];
  onOpenAuthModal: (options?: { lead?: string }) => void;
}

export function NavAuth({
  user,
  deviceSessions,
  onOpenAuthModal,
}: NavAuthProps): React.ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onDocClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [menuOpen]);

  if (!user) {
    return (
      <button
        type="button"
        className="inline-flex h-[30px] items-center rounded-full border border-white bg-white px-3.5 text-[13px] font-semibold text-brand transition hover:bg-white/90"
        onClick={() => onOpenAuthModal()}
      >
        登录
      </button>
    );
  }

  const isSuperAdmin = user.role === SUPERADMIN_ROLE;
  const name = displayAuthName(user);
  const recentSessions = pickRecentSessions(deviceSessions, user.id);

  return (
    <>
      <span
        className="inline-flex max-w-[180px] items-center gap-1.5 text-[13px] font-medium text-white"
        title={isSuperAdmin ? '超级管理员' : '普通用户'}
      >
        <span
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-full [&_svg]:h-3.5 [&_svg]:w-3.5',
            isSuperAdmin ? 'bg-amber-400/90 text-brand' : 'bg-white/20',
          )}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </span>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{name}</span>
      </span>

      <div ref={menuRef} className="nav-auth-menu relative">
        <button
          type="button"
          className={BTN_GHOST}
          aria-label="账号设置"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((prev) => !prev);
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        <div
          className={cn('nav-auth-menu__dropdown', !menuOpen && 'hidden')}
          role="menu"
        >
          {recentSessions.length > 0 ? (
            <>
              <p className="nav-auth-menu__label">切换账号</p>
              {recentSessions.map((entry) => {
                const accountUser = entry.user;
                const isCurrent = accountUser.id === user.id;
                const label = displayAuthName(accountUser);
                const initial = label.charAt(0).toUpperCase();
                return (
                  <button
                    key={accountUser.id}
                    type="button"
                    className={cn(
                      'nav-auth-menu__account',
                      isCurrent && 'is-current',
                    )}
                    role="menuitem"
                    disabled={isCurrent}
                    onClick={async () => {
                      setMenuOpen(false);
                      try {
                        await setActiveSession(entry.session.token);
                        window.location.reload();
                      } catch {
                        onOpenAuthModal({ lead: '会话已失效，请重新登录该账号' });
                      }
                    }}
                  >
                    <span className="nav-auth-menu__account-avatar">{initial}</span>
                    <span className="nav-auth-menu__account-text">
                      <span className="nav-auth-menu__account-name">{label}</span>
                      <span className="nav-auth-menu__account-email">
                        {accountUser.email}
                      </span>
                    </span>
                    {isCurrent ? (
                      <span className="nav-auth-menu__account-badge">当前</span>
                    ) : null}
                  </button>
                );
              })}
              <div className="nav-auth-menu__divider" />
            </>
          ) : null}

          <button
            type="button"
            className="nav-auth-menu__item"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onOpenAuthModal({ lead: '登录后将加入可切换账号列表' });
            }}
          >
            添加账号
          </button>
          <button
            type="button"
            className="nav-auth-menu__item nav-auth-menu__item--danger"
            role="menuitem"
            onClick={async () => {
              setMenuOpen(false);
              try {
                await signOut();
              } catch {
                // 已失效会话忽略
              }
              window.location.reload();
            }}
          >
            退出
          </button>
        </div>
      </div>
    </>
  );
}
