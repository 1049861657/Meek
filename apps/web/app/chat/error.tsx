'use client';

import { PageErrorFallback } from '@/components/page/page-error-fallback';

export default function ChatRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  return <PageErrorFallback error={error} reset={reset} title="聊天页加载失败" />;
}
