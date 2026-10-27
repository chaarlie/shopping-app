import { Button } from './ui/button';
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
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
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
      <Button
        variant="secondary"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </Button>
      <span>
        Page {page} of {Math.max(1, pages)} · {total} results
      </span>
      <Button
        variant="secondary"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </Button>
      {total > 10000 && (
        <p>Narrow your search to see results beyond the first 10,000.</p>
      )}
    </nav>
  );
}
