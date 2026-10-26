'use client';
import { useState } from 'react';
import {
  tableFeatures,
  metaHelper,
  useTable,
  type ColumnDef,
} from '@tanstack/react-table';
import {
  productCsvColumns,
  type ProductCsvColumn,
  type StagedRow,
} from '@shop/contracts';
type Meta = {
  edit: (
    row: StagedRow,
    column: ProductCsvColumn,
    value: string,
  ) => Promise<void>;
  exclude: (row: StagedRow) => void;
  compare: (sku: string) => void;
  disabled: boolean;
};
const features = tableFeatures({ tableMeta: metaHelper<Meta>() });
function EditCell({
  value,
  label,
  disabled,
  save,
}: {
  value: string;
  label: string;
  disabled: boolean;
  save: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [baseline, setBaseline] = useState(value);
  const [feedback, setFeedback] = useState('');
  if (baseline !== value) {
    setBaseline(value);
    if (draft === baseline) {
      setDraft(value);
    }
  }
  return (
    <div>
      <input
        className="cell-input"
        value={draft}
        aria-label={label}
        maxLength={10000}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) {
            const submitted = draft;
            setFeedback('Saving…');
            void save(submitted).then(
              () => setFeedback('Saved'),
              () =>
                setFeedback(
                  'Not saved. Your text is kept; leave this cell again to retry.',
                ),
            );
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') {
            setDraft(value);
          }
        }}
      />
      <small role="status">{feedback}</small>
    </div>
  );
}
const columns: ColumnDef<typeof features, StagedRow>[] = [
  { id: 'row', header: 'Row', accessorKey: 'row' },
  {
    id: 'status',
    header: 'Review & actions',
    cell: ({ row, table }) => (
      <div className="import-row-review">
        <strong
          className={`import-status import-status-${row.original.status}`}
        >
          {row.original.excluded
            ? 'Excluded from import'
            : row.original.errors.some((error) =>
                  error.includes('appears on rows'),
                )
              ? 'Conflicting duplicate'
              : row.original.status === 'error'
                ? 'Needs correction'
                : row.original.status === 'create'
                  ? 'New product'
                  : row.original.status === 'update'
                    ? 'Product update'
                    : row.original.status === 'duplicate'
                      ? 'Identical duplicate · skipped'
                      : row.original.status === 'unchanged'
                        ? 'No changes'
                        : 'Skipped'}
        </strong>
        <strong>
          {row.original.values.sku || 'Missing SKU'} · Row {row.original.row}
        </strong>
        {row.original.errors.map((error) => (
          <p className="error-text" key={error}>
            {error}
          </p>
        ))}
        {row.original.warnings.map((warning) => (
          <p className="import-warning" key={warning}>
            {warning}
          </p>
        ))}
        {!row.original.excluded && row.original.status === 'error' && (
          <p>
            {row.original.errors.some((error) =>
              error.includes('appears on rows'),
            )
              ? 'Compare the matching rows, then exclude the versions you do not want. Keep one version per SKU.'
              : 'Edit the incorrect value in this row. If left unresolved, this row will be skipped.'}
          </p>
        )}
        {!table.options.meta?.disabled && (
          <button
            className="btn-grey"
            onClick={() => table.options.meta?.exclude(row.original)}
          >
            {row.original.excluded ? 'Restore row' : 'Exclude this row'}
          </button>
        )}
        {row.original.errors.some((e) => e.includes('appears on rows')) && (
          <button
            className="btn-grey"
            onClick={() => table.options.meta?.compare(row.original.values.sku)}
          >
            Compare matching rows
          </button>
        )}
      </div>
    ),
  },
  ...productCsvColumns.map(
    (column) =>
      ({
        id: column,
        header: column,
        cell: ({ row, table }) => (
          <EditCell
            key={`${row.original.row}-${column}`}
            value={row.original.values[column]}
            label={`Row ${row.original.row} ${column}`}
            disabled={!!table.options.meta?.disabled || row.original.excluded}
            save={(value) =>
              table.options.meta!.edit(row.original, column, value)
            }
          />
        ),
      }) satisfies ColumnDef<typeof features, StagedRow>,
  ),
  {
    id: 'notes',
    header: 'Catalog changes & audit',
    cell: ({ row }) => (
      <div className="row-notes">
        {row.original.changes.map((c) => (
          <p className="change" key={c.field}>
            <strong>{c.field}</strong>
            <del>{c.before || '(empty)'}</del> →{' '}
            <ins>{c.after || '(empty)'}</ins>
          </p>
        ))}
        {row.original.editedBy && <p>Edited by {row.original.editedBy}</p>}
      </div>
    ),
  },
];
export default function ImportTable({
  rows,
  ...meta
}: { rows: StagedRow[] } & Meta) {
  const table = useTable({
    features,
    columns,
    data: rows,
    meta,
    getRowId: (row) => String(row.row),
  });
  return (
    <div className="table-scroll">
      <table className="import-table">
        <caption className="sr">
          Editable import preview. Changes save when you leave a cell.
        </caption>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th
                  key={header.id}
                  className={
                    header.column.id === 'status'
                      ? 'import-review-column'
                      : undefined
                  }
                >
                  <table.FlexRender header={header} />
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              className={
                row.original.status === 'error'
                  ? 'row-error'
                  : row.original.status === 'update'
                    ? 'row-change'
                    : ''
              }
              key={row.id}
            >
              {row.getAllCells().map((cell) => (
                <td
                  key={cell.id}
                  className={
                    cell.column.id === 'status'
                      ? 'import-review-column'
                      : productCsvColumns.includes(
                            cell.column.id as ProductCsvColumn,
                          ) &&
                          rows.some(
                            (other) =>
                              other.values.sku.trim().toUpperCase() ===
                                row.original.values.sku.trim().toUpperCase() &&
                              other.values[
                                cell.column.id as ProductCsvColumn
                              ] !==
                                row.original.values[
                                  cell.column.id as ProductCsvColumn
                                ],
                          )
                        ? 'cell-difference'
                        : undefined
                  }
                >
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
