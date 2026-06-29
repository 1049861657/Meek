import { PageLoadingSpinner } from '@/components/page/page-loading-spinner';

export default function ChatRouteLoading(): React.ReactElement {
  return <PageLoadingSpinner message="正在加载聊天…" />;
}
