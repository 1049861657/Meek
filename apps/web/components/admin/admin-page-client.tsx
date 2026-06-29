'use client';

import { useEffect } from 'react';
import { PageLoadingSpinner } from '@/components/page/page-loading-spinner';
import { useAdminApp } from '@/hooks/use-admin-app';
import { useAuth } from '@/providers/auth-provider';
import { AdminChannelsTab } from './admin-channels-tab';
import { AdminSeedPanel } from './admin-seed-panel';
import { AdminUsersTable } from './admin-users-table';

export function AdminPageClient(): React.ReactElement {
  const { user, isLoading, openAuthModal } = useAuth();
  const app = useAdminApp({ user, authLoading: isLoading, openAuthModal });
  const {
    viewMode,
    apiGateActive,
    apiGateMessage,
    authError,
    currentUser,
    activeTab,
    setActiveTab,
    allUsers,
    seedFollow,
    seedOk,
    seedErr,
    saveSeed,
    setRole,
    resetPassword,
  } = app;

  const writeDisabled = apiGateActive;
  const connected = viewMode === 'ready';

  useEffect(() => {
    document.body.classList.toggle('admin-page', true);
    document.body.classList.toggle('admin-page--connected', connected);
    return () => {
      document.body.classList.remove('admin-page', 'admin-page--connected');
    };
  }, [connected]);

  if (viewMode === 'loading') {
    return (
      <div className="admin-page">
        <PageLoadingSpinner message="正在加载系统管理…" />
      </div>
    );
  }

  if (viewMode === 'guest') {
    return (
      <div className={`admin-page admin-shell${connected ? ' admin-shell--connected' : ''}`}>
        <div
          id="empty-state"
          className="auth-gate flex min-h-[calc(100vh-var(--spacing-navbar))] items-center justify-center px-6 py-12"
        >
          <div className="w-full max-w-[400px] rounded-xl border border-[var(--color-border)] bg-white px-7 py-8 shadow-[0_8px_28px_rgb(0_0_0/0.06)]">
            <header className="text-center">
              <h1 className="m-0 text-[22px] font-semibold tracking-tight">系统管理</h1>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                管理用户账号、IM 渠道绑定与 guest 默认配置归属
              </p>
            </header>
            <div id="auth-mount" className="mt-4 flex flex-col items-center gap-4 text-center">
              <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
                登录后管理用户账号与 IM 渠道绑定
              </p>
              <button
                type="button"
                className="btn-primary btn-block min-h-11 w-full text-sm"
                onClick={app.onLoginClick}
              >
                登录
              </button>
            </div>
            {authError ? (
              <p id="auth-error" className="field-error mt-2.5 text-sm text-[#d32f2f]">
                {authError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'forbidden') {
    return (
      <div className="admin-page admin-shell">
        <div
          id="forbidden-state"
          className="flex min-h-[calc(100vh-var(--spacing-navbar))] items-center justify-center px-6 py-12"
        >
          <div className="w-full max-w-[400px] rounded-xl border border-[var(--color-border)] bg-white px-7 py-8 text-center shadow-[0_8px_28px_rgb(0_0_0/0.06)]">
            <h1 className="m-0 text-lg font-semibold">无权限</h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              系统管理仅超级管理员可访问
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page admin-shell admin-shell--connected">
      <div id="workspace" className="admin-workspace">
        {apiGateActive ? (
          <div className="admin-gate-banner" role="alert">
            {apiGateMessage}
          </div>
        ) : null}

        <header className="page-hero">
          <h1 className="page-hero__title">系统管理</h1>
          <p className="page-hero__sub">管理用户账号、IM 渠道绑定与 guest 默认配置归属</p>
        </header>

        <div
          id="section-tabs"
          className="section-tabs"
          role="tablist"
          aria-label="系统管理分区"
        >
          <button
            type="button"
            className="section-tab"
            role="tab"
            id="tab-users"
            aria-selected={activeTab === 'users'}
            aria-controls="pane-users"
            onClick={() => setActiveTab('users')}
          >
            用户管理
          </button>
          <button
            type="button"
            className="section-tab"
            role="tab"
            id="tab-channels"
            aria-selected={activeTab === 'channels'}
            aria-controls="pane-channels"
            onClick={() => setActiveTab('channels')}
          >
            渠道管理
          </button>
        </div>

        <div className="tab-content">
          <div
            className="tab-pane"
            role="tabpanel"
            id="pane-users"
            aria-labelledby="tab-users"
            hidden={activeTab !== 'users'}
          >
            {activeTab === 'users' ? (
              <div className="users-layout">
                <AdminSeedPanel
                  users={allUsers}
                  seedFollow={seedFollow}
                  seedOk={seedOk}
                  seedErr={seedErr}
                  writeDisabled={writeDisabled}
                  onSave={(userId) => void saveSeed(userId)}
                />
                <AdminUsersTable
                  users={allUsers}
                  currentUser={currentUser}
                  writeDisabled={writeDisabled}
                  onSetRole={(userId, role) => void setRole(userId, role)}
                  onResetPassword={(userId) => void resetPassword(userId)}
                />
              </div>
            ) : null}
          </div>

          <div
            className="tab-pane"
            role="tabpanel"
            id="pane-channels"
            aria-labelledby="tab-channels"
            hidden={activeTab !== 'channels'}
          >
            {activeTab === 'channels' ? (
              <AdminChannelsTab app={app} writeDisabled={writeDisabled} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
