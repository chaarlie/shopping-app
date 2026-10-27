'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  importSummarySchema,
  importUploadSchema,
  importUploadSettingsSchema,
} from '@shop/contracts';
import { request, errorMessage } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { uploadCatalog, uploadDelay } from '@/lib/import-upload';
const savedUpload = 'stockroom-import-upload';
export function useImportUpload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [session, setSession] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const router = useRouter();
  const settings = useResource(
    '/admin/import-uploads/settings',
    importUploadSettingsSchema,
  );
  useEffect(() => () => controller.current?.abort(), []);
  const remember = (id: string) => {
    setSession(id);
    sessionStorage.setItem(savedUpload, id);
  };
  const open = (id: number) => {
    sessionStorage.removeItem(savedUpload);
    router.push(`/admin/imports/${id}`);
  };
  async function resume() {
    const id = session ?? sessionStorage.getItem(savedUpload);
    if (!id) {
      setError('No saved upload in this browser tab. Choose a file to begin.');
      return;
    }
    remember(id);
    setBusy(true);
    setError('');
    setProcessing(true);
    const abort = new AbortController();
    controller.current = abort;
    try {
      let status = await request(
        `/admin/import-uploads/${id}`,
        importUploadSchema,
        { signal: abort.signal },
      );
      while (status.state === 'queued' || status.state === 'processing') {
        setProgress('Preparing your review…');
        await uploadDelay(abort.signal);
        status = await request(
          `/admin/import-uploads/${id}`,
          importUploadSchema,
          { signal: abort.signal },
        );
      }
      if (status.state === 'ready' && status.importId) {
        open(status.importId);
      } else {
        setProcessing(false);
        setError(
          status.error ??
            'Select the original file and retry, or cancel this upload.',
        );
      }
    } catch (cause) {
      setError(
        abort.signal.aborted
          ? 'Stopped waiting. You can resume this upload later.'
          : errorMessage(cause),
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(form: FormData) {
    setError('');
    const file = form.get('file');
    if (
      !(file instanceof File) ||
      !settings.data ||
      file.size === 0 ||
      file.size > settings.data.maxFileBytes
    ) {
      setError('Choose a non-empty CSV within the displayed size limit.');
      return;
    }
    setBusy(true);
    setProcessing(false);
    setProgress('Starting upload…');
    const abort = new AbortController();
    controller.current = abort;
    try {
      if (settings.data.enabled) {
        const id = await uploadCatalog(
          file,
          session,
          abort.signal,
          remember,
          (text, working) => {
            setProgress(text);
            setProcessing(working);
          },
        );
        open(id);
      } else {
        const data = new FormData();
        data.set('file', file);
        const result = await request('/admin/imports', importSummarySchema, {
          method: 'POST',
          body: data,
          signal: abort.signal,
        });
        open(result.id);
      }
    } catch (cause) {
      setError(
        abort.signal.aborted
          ? 'Upload interrupted. Retry or cancel the saved upload.'
          : errorMessage(cause),
      );
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    controller.current?.abort();
    try {
      await request(
        `/admin/import-uploads/${session}/cancel`,
        importUploadSchema,
        { method: 'POST' },
      );
      setSession(null);
      setError('');
      sessionStorage.removeItem(savedUpload);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }
  return {
    busy,
    error,
    progress,
    session,
    processing,
    settings,
    resume,
    submit,
    cancel,
    stop: () => controller.current?.abort(),
  };
}
