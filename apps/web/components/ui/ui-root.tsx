'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ConfirmDialog,
  registerDialogHost,
  type ConfirmDialogOptions,
  type DialogRequest,
} from '@/components/ui/confirm-dialog';
import {
  InputDialog,
  type InputDialogOptions,
} from '@/components/ui/input-dialog';
import { FloatingTooltipHost } from '@/components/ui/tooltip';
import { ToastHost } from '@/components/ui/toast';

export function UiRoot(): React.ReactElement {
  const [dialog, setDialog] = useState<DialogRequest | null>(null);

  useEffect(() => {
    registerDialogHost((request) => setDialog(request));
    return () => registerDialogHost(null);
  }, []);

  const closeDialog = useCallback(() => setDialog(null), []);

  return (
    <>
      <ToastHost />
      <FloatingTooltipHost />
      {dialog?.type === 'confirm' ? (
        <ConfirmDialog
          open
          {...dialog.options}
          onConfirm={() => {
            dialog.resolve(true);
            closeDialog();
          }}
          onCancel={() => {
            dialog.resolve(false);
            closeDialog();
          }}
        />
      ) : null}
      {dialog?.type === 'input' ? (
        <InputDialog
          open
          {...dialog.options}
          onConfirm={(value) => {
            dialog.resolve(value);
            closeDialog();
          }}
          onCancel={() => {
            dialog.resolve(null);
            closeDialog();
          }}
        />
      ) : null}
    </>
  );
}

export type { ConfirmDialogOptions, InputDialogOptions };
