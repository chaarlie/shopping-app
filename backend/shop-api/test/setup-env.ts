import { inject } from 'vitest';

process.env.DATABASE_URL = inject('databaseUrl');
process.env.OPENSEARCH_URL = inject('opensearchUrl');
