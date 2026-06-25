import { PageLoadingSpinner } from '@/components/page/page-loading-spinner';

export function InfoRouteLoading(): React.ReactElement {
  return (
    <div className="info-loading">
      <PageLoadingSpinner message="正在加载服务信息…" />
    </div>
  );
}
