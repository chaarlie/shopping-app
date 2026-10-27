# Object-storage CSV imports

The default maximum is **5,000,000 bytes (5 MB)**. Set `IMPORT_MAX_FILE_BYTES=10000000` in `.env` to allow up to **10 MB**. Startup validation rejects values above 10 MB. `IMPORT_MAX_ROWS` defaults to 5,000 data records and cannot exceed 20,000. The API supplies limits to the browser; it remains the enforcement boundary.

This replaces the proposed 5 GB scope. At these bounded sizes, keep the existing atomic review/apply behavior rather than exposing partially applied imports. The legacy direct upload endpoint remains limited to 1 MB. The new upload API is ready; background processing and the UI follow in dependent branches.

## Run locally

```sh
docker compose -f docker-compose.yml -f docker-compose.imports.yml up --build --wait
```

The S3 endpoint defaults to `http://localhost:9100`. `IMPORT_STORAGE_PORT` changes its port. `IMPORT_STORAGE_PUBLIC_ENDPOINT` must be reachable by the browser; `IMPORT_STORAGE_ENDPOINT` is internal. Presigned requests must use the same host used when signing. `APP_ORIGIN` configures browser CORS. All buckets and files remain private.

The server generates object keys. Authenticated admins start a session with filename and size, request part URLs and ask the API to complete or cancel the upload. Chunks are 5 MiB, the S3 multipart minimum for non-final parts; a file below that size has one part. URLs expire after 15 minutes. Authorized downloads expire after five minutes.

The API lists stored parts and verifies exact numbers and lengths, then checks the completed object's size. It never trusts client-supplied ETags or a declared size alone. Completion has a five-minute lease and recovers ambiguous storage responses using HEAD. Sessions expire after 24 hours. MinIO's stale multipart cleanup runs hourly for uploads older than 24 hours; it does not delete completed originals. There are at most two active sessions per admin and 100 MB of declared active capacity globally. Disk capacity and retained originals still need operational monitoring.

## Transactions and recovery

Storage network calls run outside database transactions through explicit `Propagation.NotSupported` orchestration handlers. Individual state transitions are atomic compare-and-set operations. Quota checks use a short database transaction. The queued session is the durable job record; the worker must finish staging and publish its import reference in one transaction so retries cannot duplicate imports.

## Storage choice

MinIO is a local S3-compatible test service. Its public repositories are archived and former Docker images are unavailable, so the Dockerfile builds pinned official source revisions. The initial build needs internet access and is slower. Local credentials live only in Compose defaults. Do not use these credentials outside local development. MinIO is AGPL-3.0; see the upstream license when redistributing it.

For AWS, retain the multipart API and browser flow, configure the bucket/region/CORS, use an IAM role instead of static credentials, select standard S3 addressing, and configure an incomplete-multipart lifecycle rule. The current adapter is configured for local path-style storage; AWS deployment is not part of this change.

## Validation

The full repository checks cover lint, build, types, unit tests and both API e2e suites. The upload API tests cover anonymous requests, ownership, quotas, configured limits, incorrect stored lengths, cancellation and retry after storage completed but its response was lost.

With MinIO running:

```sh
pnpm --filter shop-api exec vitest run --config vitest.config.storage.ts
```

These tests perform real presigned PUTs, retry a part, complete and stream the object, reject anonymous reads, and abort unfinished uploads. Processing and full 5/10 MB acceptance are checked in the dependent worker/UI branches. No 5 GB support is claimed.

## References

- [S3 multipart upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)
- [AWS SDK v3 S3 client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/)
- [MinIO source and license](https://github.com/minio/minio)
