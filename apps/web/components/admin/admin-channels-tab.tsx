'use client';

import { IM_CHANNELS } from '@/lib/admin/constants';
import type { ChannelKey } from '@/lib/admin/types';
import type { UseAdminAppResult } from '@/hooks/use-admin-app';
import { AdminChannelBinding } from './admin-channel-binding';
import { AdminChannelConfigPanel } from './admin-channel-config-panel';

export interface AdminChannelsTabProps {
  app: UseAdminAppResult;
  writeDisabled: boolean;
}

export function AdminChannelsTab({
  app,
  writeDisabled,
}: AdminChannelsTabProps): React.ReactElement {
  const {
    activeChannel,
    setActiveChannel,
    channelStatus,
    linkDotClass,
    linkDotTitle,
    allUsers,
    seedFollow,
    bindingDraft,
    getSavedBoundUserId,
    setBindingDraftValue,
    usernameById,
    channelConfigEntry,
    channelConfigLoading,
    channelConfigError,
    flashMcpIds,
    bindingFeedback,
    configFeedback,
    saveBinding,
    saveChannelConfig,
  } = app;

  return (
    <div className="channel-layout">
      <aside className="channel-rail" aria-label="渠道列表">
        <p className="channel-rail__label">渠道</p>
        <nav id="channel-rail" className="flex flex-col gap-2">
          {IM_CHANNELS.map((ch) => {
            const status = channelStatus[ch.key];
            const active = activeChannel === ch.key;
            return (
              <button
                key={ch.key}
                type="button"
                className={`channel-item${active ? ' is-active' : ''}`}
                data-channel={ch.key}
                onClick={() => setActiveChannel(ch.key)}
              >
                <span className={`channel-item__icon ${ch.iconClass}`} aria-hidden="true">
                  {ch.badge}
                </span>
                <span>
                  <span className="channel-item__name-row">
                    <span
                      className={linkDotClass(status)}
                      data-link-dot
                      title={linkDotTitle(status)}
                      aria-label={linkDotTitle(status)}
                    />
                    <span className="channel-item__name">{ch.label}</span>
                  </span>
                  <span className="channel-item__meta">default</span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div id="channel-main" className="channel-main flex flex-col gap-4">
        {IM_CHANNELS.map((ch) => {
          const visible = activeChannel === ch.key;
          const savedId = getSavedBoundUserId(ch.key);
          const fallbackId = seedFollow.userId ?? allUsers[0]?.id ?? '';
          const draftId = bindingDraft[ch.key];
          const selectedId = draftId !== undefined ? draftId : (savedId ?? fallbackId);
          const entry = channelConfigEntry(ch.key);

          return (
            <div
              key={ch.key}
              className="channel-stack flex flex-col gap-4"
              data-channel={ch.key}
              hidden={!visible}
            >
              <AdminChannelBinding
                channel={ch.key}
                users={allUsers}
                selectedUserId={selectedId}
                savedUserId={savedId}
                usernameById={usernameById}
                okMessage={bindingFeedback[ch.key]?.ok ?? null}
                errMessage={bindingFeedback[ch.key]?.err ?? null}
                writeDisabled={writeDisabled}
                onUserChange={(userId) => setBindingDraftValue(ch.key, userId)}
                onSave={() => void saveBinding(ch.key)}
              />
              <AdminChannelConfigPanel
                channel={ch.key}
                configState={entry?.state ?? null}
                formInit={entry?.formInit ?? 'profile'}
                loading={channelConfigLoading[ch.key]}
                error={channelConfigError[ch.key]}
                flashMcpIds={flashMcpIds[ch.key]}
                okMessage={configFeedback[ch.key]?.ok ?? null}
                errMessage={configFeedback[ch.key]?.err ?? null}
                writeDisabled={writeDisabled}
                onSave={(form) => {
                  const providers = entry?.state.resources.providers ?? [];
                  void saveChannelConfig(ch.key, form, providers);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
