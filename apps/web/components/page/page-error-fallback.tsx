'use client';

import { useEffect } from 'react';

export interface PageErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}

export function PageErrorFallback({
  error,
  reset,
  title = '页面出错',
}: PageErrorFallbackProps): React.ReactElement {
  useEffect(() => {
    console.error('[page-error]', error);
  }, [error]);

  return (
    <main className="page-shell page-error">
      <h1>{title}</h1>
      <p className="page-error__message">{error.message || '发生未知错误'}</p>
      <button type="button" className="page-error__retry" onClick={() => reset()}>
        重试
      </button>
    </main>
  );
}
