# Admin authentication

Named administrators are provisioned with `pnpm --filter shop-api admin:bootstrap` after building and running migrations. Set `DATABASE_URL`, `ADMIN_NAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the command environment. Repeating the command updates the account and revokes its existing sessions; there is no public sign-up.

Passwords use salted Node scrypt hashes. Only SHA-256 digests of random session tokens are stored. Sessions expire after eight hours. The storage migration is introduced before route enforcement so each change remains independently buildable; protection is enabled in the following PRs.

Opaque sessions were chosen over JWTs so sign-out and account reprovisioning revoke access immediately. Native password dependencies are avoided because their build scripts require additional package-manager configuration.

The sign-in, session and sign-out endpoints are implemented under `/api/admin`. Their controller requires a session except for sign-in, which is limited to five attempts per minute per client IP. Cookies are httpOnly and SameSite=Strict, with Secure controlled by the deployment cookie setting. `APP_ORIGIN` restricts browser writes. Global catalog protection follows separately.

Existing catalog mutation tests now use explicit administrator sessions. Public read and checkout assertions remain independent of admin authorization; the next change enables the global guard.

Global enforcement now protects catalog writes. Health, browsing, categories and guest checkout opt out explicitly. The internal signed payment webhook bypasses session and browser-origin checks, retaining its own signature guard. Unknown routes still return 404.

`GET /api/admin/products` provides authenticated, paginated product management with name/SKU filtering and an out-of-stock reorder filter. It reads Postgres directly so administrators can manage products while the search index is unavailable.

Request logs are JSON records with a generated request ID, resolved admin ID, method, path, status and duration. Passwords, cookies and request bodies are excluded. Import history and edit records are the persistent audit trail; operational logs are separate.
