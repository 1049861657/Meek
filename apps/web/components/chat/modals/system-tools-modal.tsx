'use client';

import { useEffect, useState } from 'react';

import {
  OverlayModal,
  OverlayModalBody,
  OverlayModalHeader,
} from '@/components/ui/overlay-modal';
import { ToggleSwitch } from '@/components/ui/toggle';
import { saveChatSettings, buildChatSettingsFromState } from '@/lib/chat/chat-settings-storage';

import type { ChatModalProps } from './modal-types';

export function SystemToolsModal({
  open,
  onClose,
  internals,
}: ChatModalProps): React.ReactElement {
  const orchestrator = internals.orchestratorRef.current;
  const feature = internals.featureConfigRef.current;
  const catalog = feature?.systemToolCatalog ?? [];
  const [enabled, setEnabled] = useState<string[]>(
    orchestrator?.state.enabledSystemToolNames ?? []
  );

  useEffect(() => {
    if (open && orchestrator) {
      setEnabled([...orchestrator.state.enabledSystemToolNames]);
    }
  }, [open, orchestrator]);

  const toggleTool = (codeName: string, on: boolean): void => {
    if (!orchestrator) {
      return;
    }
    const next = new Set(enabled);
    if (on) {
      next.add(codeName);
    } else {
      next.delete(codeName);
    }
    const names = [...next];
    setEnabled(names);
    orchestrator.state.enabledSystemToolNames = names;
    saveChatSettings(buildChatSettingsFromState(orchestrator.state));
  };

  return (
    <OverlayModal
      open={open}
      onClose={onClose}
      modalId="system-tools-modal"
      className="chat-modal system-tools-modal"
      panelClassName="chat-modal-panel system-tools-modal-panel"
    >
      <OverlayModalHeader
        title="系统工具"
        onClose={onClose}
        closeLabel="关闭"
      />
      <OverlayModalBody className="system-tools-modal-body">
        <ul className="system-tools-list" role="list">
          {catalog.length === 0 ? (
            <li className="system-tools-empty">暂无可用工具</li>
          ) : (
            catalog.map((tool) => {
              const on = enabled.includes(tool.codeName);
              return (
                <li key={tool.codeName} className="system-tools-item" role="listitem">
                  <div className="system-tools-item-text">
                    <div className="system-tools-item-title">
                      {tool.label || tool.codeName}
                    </div>
                    <div className="system-tools-item-summary">
                      {tool.summary?.trim() || tool.label || tool.codeName}
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={on}
                    onChange={(checked) => toggleTool(tool.codeName, checked)}
                    aria-label={`${tool.label || tool.codeName}${on ? '，已启用' : '，已关闭'}`}
                  />
                </li>
              );
            })
          )}
        </ul>
      </OverlayModalBody>
    </OverlayModal>
  );
}
