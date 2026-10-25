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
  edit: (row: StagedRow, column: ProductCsvColumn, value: string) => void;
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
  save: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <input
      className="cell-input"
      value={draft}
      aria-label={label}
      maxLength={10000}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) {
          save(draft);
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
  );
}
const columns: ColumnDef<typeof features, StagedRow>[] = [
  { id: 'row', header: 'Row', accessorKey: 'row' },
  {
    id: 'status',
    header: 'Status / decision',
    cell: ({ row, table }) => (
      <div className="stack">
        <strong>{row.original.status}</strong>
        {!table.options.meta?.disabled && (
          <button
            className="btn-grey"
            onClick={() => table.options.meta?.exclude(row.original)}
          >
            {row.original.excluded ? 'Include' : 'Exclude'}
          </button>
        )}
        {row.original.errors.some((e) => e.includes('appears on rows')) && (
          <button
            className="btn-grey"
            onClick={() => table.options.meta?.compare(row.original.values.sku)}
          >
            Compare SKU
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
            key={`${row.original.row}-${column}-${row.original.values[column]}`}
            value={row.original.values[column]}
            label={`Row ${row.original.row} ${column}`}
            disabled={!!table.options.meta?.disabled || row.original.excluded}
            save={(value) =>
              table.options.meta?.edit(row.original, column, value)
            }
          />
        ),
      }) satisfies ColumnDef<typeof features, StagedRow>,
  ),
  {
    id: 'notes',
    header: 'Review notes',
    cell: ({ row }) => (
      <div className="row-notes">
        {row.original.errors.map((e) => (
          <p className="error-text" key={e}>
            {e}
          </p>
        ))}
        {row.original.warnings.map((w) => (
          <p key={w}>{w}</p>
        ))}
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
                <th key={header.id}>
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
                    productCsvColumns.includes(
                      cell.column.id as ProductCsvColumn,
                    ) &&
                    rows.some(
                      (other) =>
                        other.values.sku.trim().toUpperCase() ===
                          row.original.values.sku.trim().toUpperCase() &&
                        other.values[cell.column.id as ProductCsvColumn] !==
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
