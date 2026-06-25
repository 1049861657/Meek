export function PageLoadingSpinner({
  message = '加载中…',
}: {
  message?: string;
}): React.ReactElement {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <div className="ui-spinner ui-spinner--lg" aria-hidden="true" />
      <p className="page-loading__text">{message}</p>
    </div>
  );
}
