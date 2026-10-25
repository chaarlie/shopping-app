import Link from 'next/link';

export function Feedback({
  message,
  retry,
  error = false,
}: {
  message: string;
  retry?: () => void;
  error?: boolean;
}) {
  return (
    <div
      className={`feedback ${error ? 'feedback-error' : ''}`}
      role={error ? 'alert' : 'status'}
    >
      <p>{message}</p>
      {retry && (
        <button className="btn-grey" onClick={retry}>
          Try again
        </button>
      )}
      {error && <Link href="/shop">Browse all products</Link>}
    </div>
  );
}

export function Pagination({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.min(
    Math.ceil(total / pageSize),
    Math.floor(10000 / pageSize),
  );
  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        className="btn-grey"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page} of {Math.max(1, pages)} · {total} results
      </span>
      <button
        className="btn-grey"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
      {total > 10000 && (
        <p>Narrow your search to see results beyond the first 10,000.</p>
      )}
    </nav>
  );
}
