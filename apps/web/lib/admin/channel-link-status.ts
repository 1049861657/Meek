import type { ChannelStatusMap } from '@/lib/admin/types';

const WORKER_HTTP_BASE = 'http://127.0.0.1:4001';

const SKIPPED_STATUS: ChannelStatusMap = {
  dingtalk: 'skipped',
  feishu: 'skipped',
};

/** 从 Worker 读取 IM 长连接态；不可达时回退 skipped */
export async function getChannelLinkStatusMap(): Promise<ChannelStatusMap> {
  try {
    const response = await fetch(`${WORKER_HTTP_BASE}/internal/channels/status`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!response.ok) {
      return SKIPPED_STATUS;
    }
    const payload = (await response.json()) as Partial<ChannelStatusMap>;
    return {
      dingtalk: payload.dingtalk ?? 'skipped',
      feishu: payload.feishu ?? 'skipped',
    };
  } catch {
    return SKIPPED_STATUS;
  }
}
