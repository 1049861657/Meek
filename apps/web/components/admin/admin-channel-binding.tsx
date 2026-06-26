'use client';

import { DropdownSelect } from '@/components/ui/dropdown-select';
import { StatusPill } from '@/components/ui/status-pill';
import type { AdminUser, ChannelKey } from '@/lib/admin/types';
import { IconBind } from './admin-icons';

export interface AdminChannelBindingProps {
  channel: ChannelKey;
  users: AdminUser[];
  selectedUserId: string;
  savedUserId: string | null;
  usernameById: (userId: string | null) => string | null;
  okMessage: string | null;
  errMessage: string | null;
  writeDisabled: boolean;
  onUserChange: (userId: string) => void;
  onSave: () => void;
}

export function AdminChannelBinding({
  channel,
  users,
  selectedUserId,
  savedUserId,
  usernameById,
  okMessage,
  errMessage,
  writeDisabled,
  onUserChange,
  onSave,
}: AdminChannelBindingProps): React.ReactElement {
  const pillLabel = savedUserId ? (usernameById(savedUserId) ?? '') : '未配置';

  return (
    <section className="panel panel--bind-compact">
      <div className="bind-toolbar">
        <div className="bind-toolbar__lead">
          <span className="bind-toolbar__icon" aria-hidden="true">
            <IconBind />
          </span>
          <div className="bind-toolbar__text">
            <h2 className="bind-toolbar__title">渠道绑定账号</h2>
            <p className="bind-toolbar__desc">
              指定本渠道使用的服务账号，决定可选的模型与 MCP
            </p>
          </div>
        </div>
        <div className="bind-toolbar__form">
          <div className="bind-toolbar__field">
            <label className="field-label" htmlFor={`bound-user-${channel}`}>
              绑定账号
            </label>
            <DropdownSelect
              id={`bound-user-${channel}`}
              value={selectedUserId}
              disabled={writeDisabled || users.length === 0}
              options={users.map((u) => ({
                value: u.id,
                label: u.username || u.email || u.id,
              }))}
              onChange={onUserChange}
            />
          </div>
          <div className="bind-toolbar__actions">
            <button
              type="button"
              className="btn-primary bind-toolbar__save"
              disabled={writeDisabled}
              data-save-binding={channel}
              onClick={onSave}
            >
              保存绑定
            </button>
            <span data-binding-meta>
              <StatusPill label={pillLabel} variant={savedUserId ? 'ok' : 'warn'} />
            </span>
          </div>
        </div>
      </div>
      <div className="bind-toolbar__feedback">
        {okMessage ? (
          <p className="save-feedback save-feedback--ok" data-binding-ok={channel}>
            {okMessage}
          </p>
        ) : null}
        {errMessage ? (
          <p className="save-feedback save-feedback--err" data-binding-err={channel}>
            {errMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
