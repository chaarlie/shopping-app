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
export function useImportReview(id: string, path: string) {
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const state = useResource(path, importPreviewSchema);
  const summary = state.data?.summary;
  async function mutate(path: string, body: unknown, method = 'POST') {
    if (locked.current) {
      return;
    }
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request(`/admin/imports/${id}${path}`, importSummarySchema, {
        method,
        body: JSON.stringify(body),
      });
      setNotice(
        path === '/apply'
          ? 'Import applied. The catalog is updated.'
          : 'Changes saved.',
      );
      state.reload();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function edit(row: StagedRow, column: ProductCsvColumn, value: string) {
    if (!summary) {
      return;
    }
    try {
      const input = editImportRowSchema.parse({
        version: summary.version,
        values: { ...row.values, [column]: value },
      });
      void mutate(`/rows/${row.row}`, input, 'PATCH');
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }
  return { state, summary, busy, error, notice, mutate, edit };
}
