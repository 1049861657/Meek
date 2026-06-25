import { PageLoadingSpinner } from '@/components/page/page-loading-spinner';

export default function AdminRouteLoading(): React.ReactElement {
  return <PageLoadingSpinner message="正在加载管理页…" />;
}
