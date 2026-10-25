import 'vitest';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    opensearchUrl: string;
  }
}
