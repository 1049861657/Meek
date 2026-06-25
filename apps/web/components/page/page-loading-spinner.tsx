import { Spinner } from '@/components/ui/spinner';

export function PageLoadingSpinner({
  message = '加载中…',
}: {
  message?: string;
}): React.ReactElement {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <Spinner size="lg" />
      <p className="page-loading__text">{message}</p>
    </div>
  );
}
