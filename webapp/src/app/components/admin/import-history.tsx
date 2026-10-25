'use client';
import { useState } from 'react';
import Link from 'next/link';
import { importHistorySchema } from '@shop/contracts';
import { useResource } from '@/lib/use-resource';
import { dateTime } from '@/lib/format';
import { Feedback, Pagination } from '../feedback';
export default function ImportHistory() {
  const [page, setPage] = useState(1);
  const state = useResource(
    `/admin/imports?page=${page}&pageSize=10`,
    importHistorySchema,
  );
  return (
    <>
      <div className="page-head">
        <h1>Import history</h1>
        <p>Every original file, review and application.</p>
        <Link className="btn-black" href="/admin/imports/new">
          Upload CSV
        </Link>
      </div>
      {state.loading ? (
        <Feedback message="Loading imports…" />
      ) : state.error ? (
        <Feedback error message={state.error} retry={state.reload} />
      ) : (
        state.data && (
          <>
            <div className="stack">
              {state.data.items.map((item) => (
                <article className="panel stack" key={item.id}>
                  <div className="section-head">
                    <h2>{item.filename}</h2>
                    <span
                      className={`stock ${item.appliedAt ? 'stock-in' : 'stock-low'}`}
                    >
                      {item.fileError
                        ? 'Invalid file'
                        : item.appliedAt
                          ? 'Applied'
                          : 'Awaiting review'}
                    </span>
                  </div>
                  <p>
                    Uploaded by {item.uploadedBy} · {dateTime(item.uploadedAt)}
                  </p>
                  {item.appliedAt && (
                    <p>
                      Applied by {item.appliedBy} · {dateTime(item.appliedAt)}
                    </p>
                  )}
                  <p>
                    {Object.entries(item.counts)
                      .map(([status, count]) => `${count} ${status}`)
                      .join(' · ')}
                  </p>
                  <div className="actions">
                    <Link
                      className="btn-black"
                      href={`/admin/imports/${item.id}`}
                    >
                      View import
                    </Link>
                    <a
                      className="btn-grey"
                      href={`/api/admin/imports/${item.id}/file`}
                    >
                      Download original
                    </a>
                  </div>
                </article>
              ))}
            </div>
            {!state.data.items.length && (
              <Feedback message="No imports yet. Upload your first CSV to get started." />
            )}
            <Pagination
              page={page}
              pageSize={10}
              total={state.data.total}
              onPage={setPage}
            />
          </>
        )
      )}
    </>
  );
}
