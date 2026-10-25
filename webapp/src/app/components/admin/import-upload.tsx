'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { importSummarySchema } from '@shop/contracts';
import { request, errorMessage } from '@/lib/api';
export default function ImportUpload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  return (
    <>
      <div className="page-head">
        <h1>Import your catalog.</h1>
        <p>Upload → review → apply. Your original file is kept unchanged.</p>
      </div>
      <form
        className="panel stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const data = new FormData(e.currentTarget);
            const file = data.get('file');
            if (
              !(file instanceof File) ||
              file.size === 0 ||
              file.size > 1000000
            ) {
              throw new Error('Choose a non-empty CSV file up to 1 MB.');
            }
            const summary = await request(
              '/admin/imports',
              importSummarySchema,
              { method: 'POST', body: data },
            );
            router.push(`/admin/imports/${summary.id}`);
          } catch (cause) {
            setError(errorMessage(cause));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          CSV file
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            disabled={busy}
          />
        </label>
        <p>
          Columns: name, sku, description, category, price, stock, weight_kg.
        </p>
        <p>
          Existing stock is preserved by default. Rows with errors are
          quarantined for review.
        </p>
        {error && <p role="alert">{error}</p>}
        <button className="btn-black" disabled={busy}>
          {busy ? 'Preparing preview…' : 'Upload and preview'}
        </button>
      </form>
    </>
  );
}
