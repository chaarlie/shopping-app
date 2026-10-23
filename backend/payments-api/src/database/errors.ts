import { QueryFailedError } from 'typeorm';

const UNIQUE_VIOLATION = '23505';

export function uniqueViolationConstraint(error: unknown): string | null {
  if (!(error instanceof QueryFailedError)) {
    return null;
  }

  const { code, constraint } = error.driverError as {
    code?: string;
    constraint?: string;
  };

  return code === UNIQUE_VIOLATION ? (constraint ?? null) : null;
}
