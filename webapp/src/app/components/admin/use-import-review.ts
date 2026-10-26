'use client';
import { useRef, useState } from 'react';
import {
  editImportRowSchema,
  importPreviewSchema,
  importSummarySchema,
  type StagedRow,
  type ProductCsvColumn,
} from '@shop/contracts';
import { useResource } from '@/lib/use-resource';
import { errorMessage, request } from '@/lib/api';
import { SerialTasks } from '@/lib/serial-tasks';
export function useImportReview(id: string, path: string) {
  const [pending, setPending] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const tasks = useRef(new SerialTasks());
  const acknowledged = useRef<{
    version: number;
    rows: Map<number, StagedRow['values']>;
  }>({ version: 0, rows: new Map() });
  const state = useResource(path, importPreviewSchema);
  const summary = state.data?.summary;
  async function save(
    action: string,
    body: Record<string, unknown>,
    method: string,
    row?: StagedRow,
    column?: ProductCsvColumn,
    value?: string,
  ) {
    setPending((count) => count + 1);
    try {
      await tasks.current.run(async () => {
        setError('');
        setNotice('');
        const version = Math.max(
          summary?.version ?? 0,
          acknowledged.current.version,
        );
        const values =
          row && column
            ? {
                ...((summary?.version ?? 0) > acknowledged.current.version
                  ? row.values
                  : (acknowledged.current.rows.get(row.row) ?? row.values)),
                [column]: value,
              }
            : undefined;
        const input = values
          ? editImportRowSchema.parse({ version, values })
          : { ...body, version };
        const updated = await request(
          `/admin/imports/${id}${action}`,
          importSummarySchema,
          { method, body: JSON.stringify(input) },
        );
        acknowledged.current.version = updated.version;
        if (row && values) {
          acknowledged.current.rows.set(row.row, values as StagedRow['values']);
        }
        try {
          const preview = await request(path, importPreviewSchema);
          state.replace(preview);
          for (const item of preview.rows) {
            acknowledged.current.rows.set(item.row, item.values);
          }
        } catch {
          if (state.data) {
            state.replace({ ...state.data, summary: updated });
          }
          setError(
            'Your change was saved, but the preview could not refresh. Reload the preview before continuing.',
          );
        }
        setNotice(
          action === '/apply'
            ? 'Import applied. The catalog is updated.'
            : 'Changes saved.',
        );
      });
    } catch (cause) {
      setError(errorMessage(cause));
      throw cause;
    } finally {
      setPending((count) => count - 1);
    }
  }
  async function mutate(
    action: string,
    body: Record<string, unknown>,
    method = 'POST',
  ) {
    try {
      await save(action, body, method);
    } catch {
      return;
    }
  }
  function edit(row: StagedRow, column: ProductCsvColumn, value: string) {
    return save(`/rows/${row.row}`, {}, 'PATCH', row, column, value);
  }
  return {
    state,
    summary,
    busy: pending > 0,
    error: error || state.error || '',
    notice,
    mutate,
    edit,
  };
}
