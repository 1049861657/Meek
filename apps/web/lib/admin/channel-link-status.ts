import type { ChannelLinkStatus, ChannelStatusMap } from '@/lib/admin/types';

/** M5 前渠道监听器未启动，对齐参考初始 linkStatus = skipped */
export function getChannelLinkStatusMap(): ChannelStatusMap {
  const skipped: ChannelLinkStatus = 'skipped';
  return {
    dingtalk: skipped,
    feishu: skipped,
  };
}
