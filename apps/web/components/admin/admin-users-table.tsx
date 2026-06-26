'use client';

import type { AdminUser } from '@/lib/admin/types';
import { SUPERADMIN_ROLE } from '@/lib/auth/constants';
import type { AuthUser } from '@/lib/auth/session';
import { IconUsers } from './admin-icons';

export interface AdminUsersTableProps {
  users: AdminUser[];
  currentUser: AuthUser | null;
  writeDisabled: boolean;
  onSetRole: (userId: string, role: string) => void;
  onResetPassword: (userId: string) => void;
}

export function AdminUsersTable({
  users,
  currentUser,
  writeDisabled,
  onSetRole,
  onResetPassword,
}: AdminUsersTableProps): React.ReactElement {
  return (
    <section className="panel" id="users-panel">
      <header className="panel__head">
        <span className="panel__icon panel__icon--users" aria-hidden="true">
          <IconUsers />
        </span>
        <div className="panel__head-main">
          <h2 className="panel__title">用户列表</h2>
          <p className="panel__desc">查看全部账号，调整角色或重置登录密码</p>
        </div>
      </header>
      <div className="panel__body">
        <table className="user-list-table">
          <colgroup>
            <col className="col-user" />
            <col className="col-email" />
            <col className="col-role" />
            <col className="col-action" />
          </colgroup>
          <thead>
            <tr>
              <th>用户</th>
              <th>邮箱</th>
              <th>角色</th>
              <th className="col-action-head">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isSelf={u.id === currentUser?.id}
                writeDisabled={writeDisabled}
                onSetRole={onSetRole}
                onResetPassword={onResetPassword}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UserRow({
  user,
  isSelf,
  writeDisabled,
  onSetRole,
  onResetPassword,
}: {
  user: AdminUser;
  isSelf: boolean;
  writeDisabled: boolean;
  onSetRole: (userId: string, role: string) => void;
  onResetPassword: (userId: string) => void;
}): React.ReactElement {
  const isSuper = user.role === SUPERADMIN_ROLE;
  const initial = (user.username || user.email || '?').charAt(0).toUpperCase();
  const avatarClass = isSuper ? 'user-avatar--admin' : 'user-avatar--seed';

  return (
    <tr>
      <td>
        <div className="user-identity">
          <span className={`user-avatar ${avatarClass}`}>{initial}</span>
          <div>
            <div className="user-name-row">
              <span className="user-name">{user.username || '(无用户名)'}</span>
              {isSelf ? <span className="tag-current">当前</span> : null}
            </div>
            <div className="user-meta">
              {new Date(user.createdAt).toLocaleDateString('zh-CN')}
            </div>
          </div>
        </div>
      </td>
      <td>
        <span className="user-email">{user.email || ''}</span>
      </td>
      <td>
        <div className={`role-toggle${isSelf ? ' role-toggle--locked' : ''}`} role="group">
          <button
            type="button"
            className={`role-toggle__btn${isSuper ? ' is-active is-active--super' : ''}`}
            disabled={isSelf || writeDisabled}
            onClick={() => onSetRole(user.id, SUPERADMIN_ROLE)}
          >
            超管
          </button>
          <button
            type="button"
            className={`role-toggle__btn${!isSuper ? ' is-active' : ''}`}
            disabled={isSelf || writeDisabled}
            onClick={() => onSetRole(user.id, 'USER')}
          >
            用户
          </button>
        </div>
      </td>
      <td className="col-action">
        <button
          type="button"
          className="btn-outline"
          disabled={writeDisabled}
          onClick={() => onResetPassword(user.id)}
        >
          重置密码
        </button>
      </td>
    </tr>
  );
}
