'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';

import type { ChatModalId, ChatStreamInternals } from '@/hooks/use-chat-stream';

import type { ChatModalProps } from './modal-types';
import type { EditMessageDraft } from './quick-messages-modal';

const HistoryModal = dynamic(
  () => import('./history-modal').then((mod) => mod.HistoryModal),
  { ssr: false }
);
const SettingsModal = dynamic(
  () => import('./settings-modal').then((mod) => mod.SettingsModal),
  { ssr: false }
);
const ContextModal = dynamic(
  () => import('./context-modal').then((mod) => mod.ContextModal),
  { ssr: false }
);
const SystemToolsModal = dynamic(
  () => import('./system-tools-modal').then((mod) => mod.SystemToolsModal),
  { ssr: false }
);
const McpModal = dynamic(
  () => import('./mcp-modal').then((mod) => mod.McpModal),
  { ssr: false }
);
const QuickMessagesModal = dynamic(
  () => import('./quick-messages-modal').then((mod) => mod.QuickMessagesModal),
  { ssr: false }
);
const EditMessageModal = dynamic(
  () => import('./edit-message-modal').then((mod) => mod.EditMessageModal),
  { ssr: false }
);
const MemoryDebugModal = dynamic(
  () => import('./memory-debug-modal').then((mod) => mod.MemoryDebugModal),
  { ssr: false }
);
const PromptsModal = dynamic(
  () => import('./prompts-modal').then((mod) => mod.PromptsModal),
  { ssr: false }
);

interface ChatModalsHostProps {
  activeModal: ChatModalId | null;
  onClose: () => void;
  internals: ChatStreamInternals;
  onOpenModal: (id: ChatModalId) => void;
}

export function ChatModalsHost({
  activeModal,
  onClose,
  internals,
  onOpenModal,
}: ChatModalsHostProps): React.ReactElement {
  const [editDraft, setEditDraft] = useState<EditMessageDraft | null>(null);

  const common: ChatModalProps = {
    open: false,
    onClose,
    internals,
  };

  const isOpen = useCallback(
    (id: ChatModalId): boolean => activeModal === id,
    [activeModal]
  );

  const closeEdit = (): void => {
    setEditDraft(null);
    onOpenModal('quick-messages');
  };

  return (
    <>
      <HistoryModal {...common} open={isOpen('history')} />
      <SettingsModal
        {...common}
        open={isOpen('settings')}
        onOpenModal={onOpenModal}
      />
      <ContextModal {...common} open={isOpen('context')} />
      <SystemToolsModal {...common} open={isOpen('system-tools')} />
      <McpModal {...common} open={isOpen('mcp')} />
      <QuickMessagesModal
        {...common}
        open={isOpen('quick-messages')}
        onOpenModal={onOpenModal}
        onSetEditDraft={setEditDraft}
      />
      <EditMessageModal
        {...common}
        open={isOpen('edit-message')}
        draft={editDraft}
        onClose={closeEdit}
        onSaved={closeEdit}
      />
      <MemoryDebugModal {...common} open={isOpen('memory-debug')} />
      <PromptsModal {...common} open={isOpen('prompts')} />
    </>
  );
}
