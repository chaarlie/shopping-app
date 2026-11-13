# Admin authentication

Administrators are named accounts, and there is no public sign-up. `pnpm --filter shop-api admin:bootstrap` creates or replaces one account after building and running migrations: set `DATABASE_URL`, `ADMIN_NAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the command environment. Repeating the command updates the account and revokes its existing sessions. For several accounts, use [YAML provisioning](#docker-provisioning).

Passwords use salted Node scrypt hashes. Only SHA-256 digests of random session tokens are stored. Sessions expire after eight hours.

Opaque sessions were chosen over JWTs so sign-out and account reprovisioning revoke access immediately. Native password dependencies are avoided because their build scripts require additional package-manager configuration.

The sign-in, session and sign-out endpoints live under `/api/admin`. Their controller requires a session except for sign-in, which is limited to five attempts per minute per client IP. Cookies are httpOnly and SameSite=Strict, with Secure controlled by the deployment cookie setting. `APP_ORIGIN` restricts browser writes.

A global guard protects catalog writes. Health, browsing, categories and guest checkout opt out explicitly. The internal signed payment webhook bypasses session and browser-origin checks, and keeps its own signature guard. Unknown routes still return 404. Catalog write tests sign in explicitly, and the public read and checkout tests run without a session.

`GET /api/admin/products` provides authenticated, paginated product management with name/SKU filtering and an out-of-stock reorder filter. It reads Postgres directly so administrators can manage products while the search index is unavailable.

Request logs are JSON records with a generated request ID, resolved admin ID, method, path, status and duration. Passwords, cookies and request bodies are excluded. Import history and edit records are the persistent audit trail; operational logs are separate.

## Docker provisioning

See [Admin accounts](../README.md#admin-accounts) for file-based passwords and the terminal `export` / `run -e` alternative. The YAML references environment variable names, not passwords. The configured environment file must exist even when passwords are forwarded from the terminal. Provisioning is an explicit command; starting the application or MinIO does not create accounts. Existing accounts are skipped unless replacement is explicitly requested.
