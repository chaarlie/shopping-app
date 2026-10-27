# Object-storage CSV imports

The default maximum is **5,000,000 bytes (5 MB)**. Set `IMPORT_MAX_FILE_BYTES=10000000` in `.env` to allow up to **10 MB**. Startup validation rejects values above 10 MB. `IMPORT_MAX_ROWS` defaults to 5,000 data records and cannot exceed 20,000. The API supplies limits to the browser; it remains the enforcement boundary.

This replaces the proposed 5 GB scope. At these bounded sizes, keep the existing atomic review/apply behavior rather than exposing partially applied imports. The legacy direct upload endpoint remains limited to 1 MB. The admin upload screen discovers the server limits, uploads directly to object storage and waits for the saved preview.

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

These tests perform real presigned PUTs, retry a part, complete and stream the object, reject anonymous reads, and abort unfinished uploads. Processing tests stage and apply catalogs of exactly 5 MB and 10 MB, recover expired leases, fence old workers, reject excessive record counts, and clean expired uploads. Manual browser acceptance is delegated to the user. No 5 GB support is claimed.

## References

- [S3 multipart upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)
- [AWS SDK v3 S3 client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/)
- [MinIO source and license](https://github.com/minio/minio)

## Bounded processing

A worker inside shop-api claims one queued file at a time with a ten-minute database lease. It reads at most the accepted byte count (never over 10 MB), then parses the bounded file in memory. This intentionally does not claim streaming support for arbitrarily large files. CSV records are limited to 100,000 characters; all data records, including blank ones, count toward the configured row limit. Grouping duplicate SKUs is linear and conflict messages list at most 20 row numbers.

Staging uses 500-row insert batches inside one transaction. Saving the preview and publishing the upload's import ID share that transaction. A lost worker can retry without duplicate imports; stale lease tokens cannot publish. Transient processing failures retry up to three claims. Malformed CSV is retained as an original with a reviewable file error. Completed originals stay in MinIO, with their SHA-256, byte size and audit metadata in Postgres. Downloads authorize the admin before redirecting to a five-minute presigned URL.

Apply retains a single transaction and existing stock-preservation, duplicate resolution and catalog-conflict rules. Product inserts are chunked inside that transaction to avoid PostgreSQL parameter limits; chunks do not mean partial commits.

## Browser behavior

Part failures retry up to three times with a fresh URL. The progress message distinguishes uploading from preparing the preview. A saved upload ID in session storage lets Resume saved upload recover processing after a refresh in the same tab. Retry upload resends parts from the selected original file. Cancel upload is available before processing; Stop waiting during processing does not cancel the server job. Once ready, the normal review screen opens. With the storage override disabled, the screen keeps the legacy 1 MB upload path.

To test the extension, set `IMPORT_MAX_FILE_BYTES=10000000` in `.env`, start the imports Compose configuration, and use a CSV above 1 MB. Check upload progress, preview, apply, original download, reload/resume and configured-limit rejection.
