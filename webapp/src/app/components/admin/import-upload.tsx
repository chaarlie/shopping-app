'use client';
import { Button } from '../ui/button';
import { useImportUpload } from './use-import-upload';
export default function ImportUpload() {
  const {
    busy,
    error,
    progress,
    session,
    processing,
    settings,
    resume,
    submit,
    cancel,
    stop,
  } = useImportUpload();
  return (
    <>
      <div className="page-head">
        <h1>Import your catalog.</h1>
        <p>Upload → review → apply. Your original file is kept unchanged.</p>
      </div>
      <form
        className="panel stack"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(new FormData(event.currentTarget));
        }}
      >
        <label>
          CSV file
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            disabled={busy || processing}
          />
        </label>
        {settings.data && (
          <p>
            Maximum {settings.data.maxFileBytes / 1_000_000} MB ·{' '}
            {settings.data.maxRows.toLocaleString()} rows.
          </p>
        )}
        <p>
          Columns: name, sku, description, category, price, stock, weight_kg.
        </p>
        <p>
          Existing stock is preserved by default. Rows with errors are
          quarantined for review.
        </p>
        {(error || settings.error) && (
          <p role="alert">{error || settings.error}</p>
        )}
        {busy && (
          <p role="status" aria-live="polite">
            {progress}
          </p>
        )}
        <div className="actions">
          <Button
            variant="primary"
            type="submit"
            disabled={busy || !settings.data || processing}
          >
            {busy
              ? 'Working…'
              : session
                ? 'Retry upload'
                : 'Upload and preview'}
          </Button>
          {settings.data?.enabled && (
            <Button
              variant="secondary"
              type="button"
              disabled={busy}
              onClick={() => void resume()}
            >
              Resume saved upload
            </Button>
          )}
          {busy && processing && (
            <Button variant="secondary" type="button" onClick={stop}>
              Stop waiting
            </Button>
          )}
          {session && !processing && (
            <Button
              variant="secondary"
              type="button"
              onClick={() => void cancel()}
            >
              Cancel upload
            </Button>
          )}
          {settings.error && (
            <Button variant="secondary" type="button" onClick={settings.reload}>
              Retry settings
            </Button>
          )}
        </div>
      </form>
    </>
  );
}
