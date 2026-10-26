'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useImportReview } from './use-import-review';
import { Feedback, Pagination } from '../feedback';
import ImportTable from './import-table';
export default function ImportReview({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [sku, setSku] = useState('');
  const { state, summary, busy, error, notice, mutate, edit } = useImportReview(
    id,
    `/admin/imports/${id}?page=${page}&pageSize=15&status=${status}${sku ? `&sku=${encodeURIComponent(sku)}` : ''}`,
  );
  if (state.loading) {
    return <Feedback message="Loading import preview…" />;
  }
  if (!summary || !state.data) {
    return (
      <Feedback
        error
        message={state.error || 'Import unavailable'}
        retry={state.reload}
      />
    );
  }
  if (summary.fileError) {
    return (
      <section className="panel stack">
        <h1>File needs correction</h1>
        <p role="alert">{summary.fileError}</p>
        <p>
          The original file is saved in history. Correct the CSV and upload it
          again.
        </p>
        <a href={`/api/admin/imports/${id}/file`}>Download original</a>
        <Link href="/admin/imports/new">Upload corrected file</Link>
      </section>
    );
  }
  const { counts } = summary;
  return (
    <>
      <div className="page-head">
        <h1>{summary.appliedAt ? 'Import applied' : 'Review your import.'}</h1>
        <p>
          {summary.filename} · uploaded by {summary.uploadedBy}
        </p>
      </div>
      <div className="admin-tiles">
        <div className="panel">
          <span>Ready to load</span>
          <strong>{(counts.create || 0) + (counts.update || 0)}</strong>
          <span>
            {counts.create || 0} new · {counts.update || 0} updates
          </span>
        </div>
        <div className="panel dark-tile">
          <span>Needs attention</span>
          <strong>{counts.error || 0}</strong>
          <span>
            {counts.excluded || 0} excluded · {summary.blankRows} blank rows
          </span>
        </div>
      </div>
      {!summary.appliedAt && (counts.error || 0) > 0 && (
        <section
          className="import-attention"
          aria-label="Import needs attention"
        >
          <div>
            <h2>{counts.error} rows need your attention</h2>
            <p>
              Conflicting duplicates block this import. Other invalid rows are
              skipped until corrected. Each row explains the issue and what to
              do next.
            </p>
          </div>
          <button
            className="btn-grey"
            onClick={() => {
              setSku('');
              setStatus('error');
              setPage(1);
            }}
          >
            Show rows to fix
          </button>
        </section>
      )}
      <div className="panel stack">
        <p>
          Cells save when you leave them. Conflicting SKUs must be resolved:
          compare the rows, keep one by excluding the others, or edit their
          SKUs. Other invalid rows remain quarantined and are skipped when
          applying.
        </p>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={summary.updateStock}
            disabled={busy || !!summary.appliedAt}
            onChange={(e) =>
              void mutate('/refresh', {
                version: summary.version,
                updateStock: e.target.checked,
              })
            }
          />
          Also update existing product stock from this file
        </label>
        <p>
          Without this option, re-importing cannot restore sold units. Negative
          file stock becomes zero and records the shortfall.
        </p>
        <div className="actions">
          <a className="btn-grey" href={`/api/admin/imports/${id}/file`}>
            Download original
          </a>
          {!summary.appliedAt && (
            <button
              className="btn-grey"
              disabled={busy}
              onClick={() =>
                void mutate('/refresh', { version: summary.version })
              }
            >
              Refresh catalog comparison
            </button>
          )}
          <Link href="/admin/imports">Import history</Link>
        </div>
      </div>
      {error && (
        <div className="feedback feedback-error" role="alert">
          <p>{error}</p>
          <button className="btn-grey" onClick={state.reload}>
            Reload preview
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="catalog-toolbar">
        <label>
          Rows
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {[
              'all',
              'create',
              'update',
              'unchanged',
              'duplicate',
              'error',
              'excluded',
            ].map((s) => (
              <option value={s} key={s}>
                {
                  {
                    all: 'All rows',
                    create: 'New products',
                    update: 'Product updates',
                    unchanged: 'No changes',
                    duplicate: 'Identical duplicates',
                    error: 'Needs attention',
                    excluded: 'Excluded rows',
                  }[s]
                }
              </option>
            ))}
          </select>
        </label>
        {sku && (
          <div className="import-comparison">
            <strong>Compare versions of {sku}</strong>
            <p>
              Yellow cells show different values. Exclude the unwanted rows to
              keep one version, or correct a SKU if these are different
              products. Changes save when you leave a cell.
            </p>
            <button
              className="btn-grey"
              onClick={() => {
                setSku('');
                setStatus('all');
                setPage(1);
              }}
            >
              Back to all rows
            </button>
          </div>
        )}
      </div>
      <ImportTable
        rows={state.data.rows}
        edit={edit}
        disabled={!!summary.appliedAt}
        exclude={(row) =>
          void mutate(
            `/rows/${row.row}`,
            { version: summary.version, excluded: !row.excluded },
            'PATCH',
          )
        }
        compare={(value) => {
          setSku(value);
          setStatus('all');
          setPage(1);
        }}
      />
      {!state.data.rows.length && <Feedback message="No rows in this view." />}
      <Pagination
        page={page}
        pageSize={15}
        total={state.data.total}
        onPage={setPage}
      />
      {!summary.appliedAt && (
        <aside className="import-bar">
          <div>
            <h2>Ready to update the catalog?</h2>
            <p>
              {counts.error || 0} invalid rows will stay quarantined. Unresolved
              SKU conflicts block applying.
            </p>
          </div>
          <button
            className="btn-grey"
            disabled={busy}
            onClick={() => void mutate('/apply', { version: summary.version })}
          >
            {busy ? 'Saving…' : 'Apply import'}
          </button>
        </aside>
      )}
    </>
  );
}
