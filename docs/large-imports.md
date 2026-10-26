# Large CSV imports

The user requested direct S3-compatible uploads and a path to files up to **5,000,000,000 bytes**. This is additional scope beyond the challenge. The existing 1 MB synchronous import remains available.

## Rollout

1. Storage and contracts: private MinIO bucket, S3 adapter, fixed 16 MiB multipart chunks and boundary tests.
2. Authenticated upload sessions: generated keys, server-side part verification, completion and cancellation.
3. Durable jobs and streamed staging: bounded batches, whole-file duplicate detection and crash recovery.
4. Paginated review and resumable apply, with explicit partial completion semantics for large imports.
5. Browser progress, retries and recovery; full-size acceptance tests.

The foundation does not yet enable large uploads in the admin screen. Do not claim 5 GB import support before processing and recovery have been tested at that size.

## Local storage

```sh
docker compose -f docker-compose.yml -f docker-compose.imports.yml up --build --wait
```

The S3 endpoint is `http://localhost:9100`; `IMPORT_STORAGE_PORT` changes its port. `IMPORT_STORAGE_PUBLIC_ENDPOINT` is the browser-reachable origin used for signatures; `IMPORT_STORAGE_ENDPOINT` is the internal endpoint. Signatures must be generated for the endpoint the browser actually uses. `APP_ORIGIN` configures CORS. The bucket is private. Multipart URLs expire after 15 minutes; authorized download URLs after five minutes. Unfinished multipart uploads expire after one day; completed objects are not deleted by that rule.

MinIO's public repositories are archived and its former Docker images are unavailable. The local-only Dockerfile builds the server and client from pinned official source commits. This adds initial build time. The adapter uses AWS SDK v3 rather than MinIO-specific APIs, allowing a maintained S3 service later. Local credentials are Compose defaults only; set independent credentials outside local development. MinIO is AGPL-3.0; see its upstream license before redistributing or deploying it.

## Tests

```sh
pnpm --filter shop-api exec vitest run --config vitest.config.storage.ts
```

Start MinIO and its initializer first. The tests use real presigned PUTs, retry a part, complete and read the file, reject anonymous reads, and cancel unfinished uploads. Boundary contract tests distinguish decimal GB from GiB. This small multipart test is not a 5 GB load test.

The acceptance suite must eventually generate a full-size CSV, check peak memory, verify exact row counts, interrupt each phase and prove recovery without repeated product writes. A file-size limit also needs row/record bounds and storage capacity controls; file size alone does not bound staging expansion.

## References

- [S3 multipart upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)
- [AWS SDK v3 S3 client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/)
- [MinIO source and license](https://github.com/minio/minio)
