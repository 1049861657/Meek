'use client';

import {
  OverlayModal,
  OverlayModalBody,
  OverlayModalHeader,
} from '@/components/ui/overlay-modal';

import type { ChatModalProps } from './modal-types';

/** M4-06 门控：记忆调试 API 未就绪时仅展示壳 */
export function MemoryDebugModal({ open, onClose }: ChatModalProps): React.ReactElement {
  return (
    <OverlayModal
      open={open}
      onClose={onClose}
      modalId="memory-debug-modal"
      className="chat-modal md-modal"
      panelClassName="md-modal-panel"
      wide
    >
      <OverlayModalHeader title="记忆调试" onClose={onClose} />
      <OverlayModalBody>
        <div className="md-banner md-banner--error" role="alert">
          记忆调试功能尚未就绪（依赖 M4-06 Memory API）。请在服务端配置 Hindsight 并完成 M4 批次后使用。
        </div>
        <p className="md-intro">
          此模态将支持 Recall 检索、Reflect 推理与注入预览；当前为占位壳。
        </p>
      </OverlayModalBody>
    </OverlayModal>
  );
}
