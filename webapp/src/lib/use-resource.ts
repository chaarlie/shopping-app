'use client';

import { useEffect, useState } from 'react';
import type { z } from 'zod';
import { request, errorMessage } from './api';

type Resource<T> = { data: T | null; error: string | null; loading: boolean };

export function useResource<T>(path: string, schema: z.ZodType<T>) {
  const [result, setResult] = useState<Resource<T> & { path: string }>({
    path: '',
    data: null,
    error: null,
    loading: true,
  });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request(path, schema, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) {
          setResult({ path, data, error: null, loading: false });
        }
      },
      (error) => {
        if (!controller.signal.aborted) {
          setResult((previous) => ({
            path,
            data: previous.path === path ? previous.data : null,
            error: errorMessage(error),
            loading: false,
          }));
        }
      },
    );
    return () => controller.abort();
  }, [path, schema, revision]);
  const current =
    result.path === path ? result : { data: null, error: null, loading: true };
  return {
    ...current,
    replace: (data: T) =>
      setResult({ path, data, error: null, loading: false }),
    reload: () => {
      setResult((previous) => ({
        ...previous,
        error: null,
        loading: !previous.data,
      }));
      setRevision((v) => v + 1);
    },
  };
}
