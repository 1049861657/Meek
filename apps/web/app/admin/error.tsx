'use client';

import { PageErrorFallback } from '@/components/page/page-error-fallback';

export default function AdminRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  return <PageErrorFallback error={error} reset={reset} title="管理页加载失败" />;
}
