import { Button } from '../ui/button';
type ImportReviewFiltersProps = {
  status: string;
  sku: string;
  onStatusChange: (status: string) => void;
  onClearComparison: () => void;
};
export function ImportReviewFilters({
  status,
  sku,
  onStatusChange,
  onClearComparison,
}: ImportReviewFiltersProps) {
  return (
    <div className="catalog-toolbar">
      <label>
        Rows
        <select
          value={status}
          onChange={(e) => {
            onStatusChange(e.target.value);
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
            keep one version, or correct a SKU if these are different products.
            Changes save when you leave a cell.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              onClearComparison();
            }}
          >
            Back to all rows
          </Button>
        </div>
      )}
    </div>
  );
}
