'use client';

import { IconServerEmpty } from '@/components/info/info-icons';
import { ServerDetailView } from '@/components/info/server-detail-view';
import { ServerFormView } from '@/components/info/server-form-view';
import type { UseInfoAppResult } from '@/hooks/use-info-app';

export function InfoEmptyView(): React.ReactElement {
  return (
    <div className="view active" id="v-empty">
      <div className="empty-state">
        <IconServerEmpty />
        <h3>选择或新增服务器</h3>
        <p>从左侧列表进入详情，或新建 MCP 连接</p>
      </div>
    </div>
  );
}

export interface InfoMainViewsProps {
  app: UseInfoAppResult;
}

export function InfoMainViews({ app }: InfoMainViewsProps): React.ReactElement {
  const { view, currentData } = app;

  if (view === 'form') {
    return (
      <div className="view active" id="v-form" data-requires-auth>
        <ServerFormView app={app} />
      </div>
    );
  }

  if (view === 'detail' && currentData?.currentServerId) {
    return <ServerDetailView app={app} />;
  }

  return <InfoEmptyView />;
}
