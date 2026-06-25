import { PageLoadingSpinner } from '@/components/page/page-loading-spinner';

export default function AiRouteLoading(): React.ReactElement {
  return <PageLoadingSpinner message="正在加载聊天…" />;
}
