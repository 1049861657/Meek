'use client';

import { useEffect, useState } from 'react';
import { DropdownSelect } from '@/components/ui/dropdown-select';
import { StatusPill } from '@/components/ui/status-pill';
import type { AdminUser, SeedFollow } from '@/lib/admin/types';
import { SUPERADMIN_ROLE } from '@/lib/auth/constants';
import { IconMessage, IconSeed, IconUser } from './admin-icons';

export interface AdminSeedPanelProps {
  users: AdminUser[];
  seedFollow: SeedFollow;
  seedOk: string | null;
  seedErr: string | null;
  writeDisabled: boolean;
  onSave: (userId: string) => void;
}

export function AdminSeedPanel({
  users,
  seedFollow,
  seedOk,
  seedErr,
  writeDisabled,
  onSave,
}: AdminSeedPanelProps): React.ReactElement {
  const pillLabel = seedFollow.userId ? (seedFollow.username ?? '已配置') : '未配置';

  return (
    <section className="panel" id="seed-panel">
      <header className="panel__head">
        <span className="panel__icon panel__icon--seed" aria-hidden="true">
          <IconSeed />
        </span>
        <div className="panel__head-main">
          <h2 className="panel__title">默认配置归属</h2>
          <p className="panel__desc">指定 guest 访客与未绑定 IM 路由所继承的有效配置</p>
        </div>
        <div className="panel__meta">
          <StatusPill
            label={pillLabel}
            variant={seedFollow.userId ? 'ok' : 'warn'}
          />
        </div>
      </header>
      <div className="panel__body seed-panel__body">
        <div className="seed-scope">
          <p className="seed-scope__label">生效范围</p>
          <ul className="seed-scope__list">
            <li className="seed-scope__item">
              <span className="seed-scope__item-icon" aria-hidden="true">
                <IconUser />
              </span>
              <div>
                <strong>Guest 访客</strong>
                未登录 Web 访问时的默认 AI / MCP 配置
              </div>
            </li>
            <li className="seed-scope__item">
              <span className="seed-scope__item-icon" aria-hidden="true">
                <IconMessage />
              </span>
              <div>
                <strong>未绑定 IM 路由</strong>
                飞书 / 钉钉等渠道尚未映射到具体用户时
              </div>
            </li>
          </ul>
        </div>
        <SeedForm
          users={users}
          selectedUserId={seedFollow.userId ?? ''}
          seedOk={seedOk}
          seedErr={seedErr}
          writeDisabled={writeDisabled}
          onSave={onSave}
        />
      </div>
    </section>
  );
}

function SeedForm({
  users,
  selectedUserId,
  seedOk,
  seedErr,
  writeDisabled,
  onSave,
}: {
  users: AdminUser[];
  selectedUserId: string;
  seedOk: string | null;
  seedErr: string | null;
  writeDisabled: boolean;
  onSave: (userId: string) => void;
}): React.ReactElement {
  const [userId, setUserId] = useState(selectedUserId);

  useEffect(() => {
    setUserId(selectedUserId);
  }, [selectedUserId]);

  return (
    <div className="config-action-card">
      <div className="config-action-card__field">
        <label className="field-label" htmlFor="seed-account">
          种子账号
        </label>
        <DropdownSelect
          id="seed-account"
          value={userId}
          disabled={writeDisabled || users.length === 0}
          options={users.map((u) => ({
            value: u.id,
            label: u.username || u.email || u.id,
          }))}
          onChange={setUserId}
        />
      </div>
      <div className="config-action-card__footer">
        <button
          type="button"
          className="btn-primary btn-save"
          id="btn-save-seed"
          disabled={writeDisabled}
          onClick={() => onSave(userId)}
        >
          保存
        </button>
        {seedOk ? <p className="save-feedback save-feedback--ok">{seedOk}</p> : null}
        {seedErr ? <p className="save-feedback save-feedback--err">{seedErr}</p> : null}
      </div>
    </div>
  );
}