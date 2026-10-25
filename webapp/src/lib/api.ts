import { z } from 'zod';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  const signal = init.signal
    ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
    : AbortSignal.timeout(15000);
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers,
      signal,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch (error) {
    if (init.signal?.aborted) {
      throw error;
    }
    throw new ApiError(0, 'The connection was interrupted. Please try again.');
  }
  const body: unknown =
    response.status === 204
      ? undefined
      : await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = z
      .object({ message: z.union([z.string(), z.array(z.string())]) })
      .safeParse(body);
    const message = parsed.success
      ? [parsed.data.message].flat().join(' ')
      : `Request failed (${response.status}). Please try again.`;
    throw new ApiError(response.status, message);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(
      502,
      'The server returned an unexpected response. Please try again.',
    );
  }
  return parsed.data;
}

export function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(' ');
  }
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}
