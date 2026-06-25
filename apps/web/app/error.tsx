'use client';

import { PageErrorFallback } from '@/components/page/page-error-fallback';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  return <PageErrorFallback error={error} reset={reset} />;
}
