# Shopping App

An e-commerce system made of two NestJS services and a Next.js storefront: a product catalog with search and CSV import, guest checkout, and a simulated payment gateway that reports results back through signed webhooks.

Most of the work went into the parts that have to stay correct when something fails:

- **Checkout across two services.** shop-api takes the stock and creates the order in one transaction. payments-api plays a payment gateway and reports each result as a [Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks) event sent from a transactional outbox. shop-api applies each event once, a reconciliation job settles orders whose result never arrives, and the browser follows the order live over server-sent events. See [Checkout flow](docs/checkout-flow.md).
- **No overselling and no double charge.** Stock is taken only if enough is left, in the same transaction as the order. Every payment attempt carries an `Idempotency-Key`, a request hash refuses a reused key with different data, and a partial unique index allows one active payment per order, whatever the key.
- **Search that never shows a stale price.** OpenSearch ranks results and forgives typos. A database trigger queues every change in an outbox that keeps the index in step, and the results are read back from Postgres. See [Product search](docs/product-search.md).
- **CSV import with a review step.** Every upload is stored and every row staged. An admin resolves conflicting SKUs and corrects rows, each edit is audited, and the load runs in one transaction that refuses to apply if the catalog changed since the preview. See [Product import](docs/product-import.md) and [Saved import review](docs/import-portal.md).
- **Tests against real infrastructure.** The e2e suites run against Postgres and OpenSearch in throwaway containers, and each guarantee of the checkout design has a test that was seen failing against a broken version of the code.

## Stack

- **Backend:** NestJS 12 with `@nestjs/cqrs`, TypeORM 1.1 with hand-written migrations, Postgres 17 and OpenSearch 3.5.
- **Frontend:** Next.js 16 and React 19, with TanStack Table 9 for the editable import review.
- **Shared contracts:** zod 4 schemas in `packages/contracts`, used by both APIs and the webapp.
- **Runtime:** Docker Compose behind nginx, with optional MinIO for object-storage imports.
- **Tests:** Vitest, Supertest and Testcontainers.

## Run locally

Requirements: Docker with Docker Compose v2.

```sh
docker compose up --build
```

Then open http://localhost:8080. The API is served under http://localhost:8080/api, and http://localhost:8080/api/health reports whether it is up.

The storefront and checkout work without an account. Catalog changes and imports need an admin, created as described in [Admin accounts](#admin-accounts). Payments accept only the simulated gateway's test cards, with an expiry date in the future and a CVC of 3 or 4 digits:

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | Visa, approved |
| `5555 5555 5555 4444` | Mastercard, approved |
| `4000 0000 0000 0002` | Visa, declined |
| `4000 0000 0000 9995` | Visa, declined for insufficient funds |

## What it does

- **Storefront:** a home page, category browsing, search, product pages, a cart, guest checkout and a live order status page. Product cards can add one unit straight to the cart. After a decline, the customer can pay with another card until the order is due, 15 minutes after it was placed.
- **Admin** (`/admin`): creating, editing and deleting products, with version checks so a stale edit gets a 409 instead of overwriting someone else's change; a filter for products that need reordering; CSV import with a saved, paginated review; import history with a download of each original file; and an orders view of paid purchases, with status filters, the guest's contact details and the purchased lines as they were at checkout.

## Use the API from the command line

Sign in as an admin, keeping the session cookie in a file, then import the sample catalog and search it. The first search can take a second while the index fills:

```sh
curl -s -c admin.txt -X POST localhost:8080/api/admin/sign-in -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.test","password":"your-chosen-long-password"}'

curl -s -b admin.txt -X POST localhost:8080/api/products/import -F "file=@backend/sample-data/products.csv"

curl -s 'localhost:8080/api/products?q=runing%20shoes'
curl -s 'localhost:8080/api/products?q=wireless&category=Electronics&sort=price_asc'
curl -s localhost:8080/api/categories
```

Creating a product uses the same session:

```sh
curl -s -b admin.txt -X POST localhost:8080/api/products -H 'Content-Type: application/json' \
  -d '{"sku":"RS-001","name":"Running Shoes","category":"Footwear","priceCents":8999,"stock":3}'
```

Buying needs no session. Replace `1` with a product id from the search results:

```sh
curl -s -c cookies.txt -X POST localhost:8080/api/orders -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"name":"Ada Lovelace","email":"ada@example.com","items":[{"productId":1,"quantity":1}],
       "card":{"number":"4242 4242 4242 4242","expMonth":12,"expYear":2030,"cvc":"123"}}'

curl -s -N -b cookies.txt localhost:8080/api/orders/<reference>/events
```

The order answers `pending_payment` at once. The stream then shows it paid about two seconds later, when the simulated provider answers and its webhook arrives. After a decline, `POST /api/orders/<reference>/payments` with another card and a new `Idempotency-Key` tries again.

## Sample data

[`backend/sample-data/products.csv`](backend/sample-data/products.csv) is a product catalog with rows that are broken on purpose: SKUs repeated with conflicting values, prices such as `free`, `$29.99` and `0.00`, negative stock, blank names, and names that contain HTML or SQL. Importing it creates 86 products, rejects 9 rows and skips 2 blank ones. [KNOWN_ISSUES.md](KNOWN_ISSUES.md) shows how each problem row is handled, and `plan-product-import.spec.ts` checks every one.

The file has CRLF line endings, and `.gitattributes` keeps git from converting them, so the tests read the same bytes an upload would send.

## Design

- [Architecture](docs/architecture.md): the containers, and what each one can reach.
- [Checkout flow](docs/checkout-flow.md): how shop-api and payments-api settle a purchase with signed webhooks and live updates, including declines, expired orders and late payments.
- [Product search](docs/product-search.md): what search finds, how the OpenSearch index stays in step with Postgres, and what happens when OpenSearch is down.
- [Product import](docs/product-import.md): how each CSV row is accepted, fixed or rejected.
- [Saved import review](docs/import-portal.md): stored uploads, staged rows, audited corrections and the one-transaction load.
- [Object-storage imports](docs/large-imports.md): multipart uploads to S3-compatible storage and the background staging job.
- [Admin authentication](docs/admin-auth.md): named admins, sessions, origin checks and request logs.

## Decisions

- **CSV import.** Rows that disagree about a SKU are rejected rather than guessed, products that already exist are updated, and stock is set rather than added, so importing the same file twice changes nothing. [Product import](docs/product-import.md#decisions) explains each choice and the alternatives.
- **Payment results.** payments-api reports each payment to shop-api as a signed webhook, sent from an outbox that retries until shop-api confirms, the way a payment gateway reports to a merchant. RabbitMQ between the services was the alternative. [Checkout flow](docs/checkout-flow.md#decisions) explains the choice.
- **Search.** OpenSearch ranks results and forgives typos, and a database trigger fills an outbox that keeps its index in step with Postgres. What a search shows is read back from Postgres, so prices and stock are never stale. OpenSearch was chosen over Elasticsearch to match Amazon's managed service, and over Postgres trigram search for ranking and analyzers. [Product search](docs/product-search.md#decisions) explains the choices.

## Known issues

[KNOWN_ISSUES.md](KNOWN_ISSUES.md) lists how each problem row in the sample CSV is handled, and the known bugs and limitations.

## Development

Requirements: Node.js 24, pnpm 10.28 and Docker.

```sh
pnpm install
pnpm -r lint
pnpm -r build
pnpm -r typecheck
pnpm -r test
pnpm --filter shop-api --filter payments-api test:e2e
```

`typecheck` covers the tests as well as the source, and needs `build` first so the shared packages are compiled. Both services' e2e tests start throwaway containers with Testcontainers, Postgres for both and OpenSearch for shop-api, so Docker must be running.

To run a service outside Docker, use `pnpm --filter shop-api start:dev` or `pnpm --filter payments-api start:dev`. Both listen on port 3000 unless `PORT` is set, so give one of them another port to run both.

- `shop-api` needs `DATABASE_URL`, a Postgres connection URL. Apply migrations with `pnpm --filter shop-api build` followed by `pnpm --filter shop-api migration:run`. For checkout it also needs `PAYMENTS_API_URL` and `PAYMENTS_API_KEY`, to reach payments-api, `PAYMENT_WEBHOOK_SECRET`, the same secret payments-api signs its webhooks with, and `ORDER_ACCESS_SECRET`, at least 32 characters, which signs the order access cookies. Set `ORDER_COOKIE_SECURE=false` when it isn't served over HTTPS. For search it needs `OPENSEARCH_URL`, and `OPENSEARCH_INDEX` names the index alias (`products` by default). `pnpm --filter shop-api search:rebuild` rebuilds the index from Postgres.
- `payments-api` needs `PAYMENTS_API_KEY`, at least 32 characters, and `DATABASE_URL` for its own database. Apply its migrations the same way, with `pnpm --filter payments-api migration:run`. It also needs `PAYMENT_WEBHOOK_URL`, where it posts payment results, and `PAYMENT_WEBHOOK_SECRET`, in the Standard Webhooks format described below, which signs them. `PAYMENT_SETTLE_DELAY_MS` sets how long the simulated card provider takes to answer (2000 by default), and `BACKGROUND_JOBS=off` stops its workers, which the e2e tests use to run them step by step.

The webapp can also run on its own against the Docker stack; see [webapp/README.md](webapp/README.md).

## Configuration

### Ports and origins

Copy `.env.example` to `.env` and set `APP_PORT` before running `docker compose up --build`. The default remains http://localhost:8080. The default admin allowed origins follow `APP_PORT` and include the separate development frontend at http://localhost:3107. Set `APP_ORIGIN` explicitly to comma-separated origins without trailing slashes when using a custom hostname or development frontend port. Compose reads `.env` for substitution; only variables explicitly wired into services are passed into their containers. Shell variables override the file.

Internal service ports stay fixed, keeping service URLs and health checks consistent. For direct debugging, opt in with `docker compose -f docker-compose.yml -f docker-compose.debug.yml up --build`. The override publishes webapp, shop API, payments API, Postgres and OpenSearch only on localhost, using the host ports in `.env.example`. The webapp's normal browser API requests still use nginx; use the main application URL for full user journeys. Do not use this override for deployment. Service keys and admin authorization still apply.

Compose also accepts `SHOP_DB_PASSWORD`, `PAYMENTS_DB_PASSWORD`, `POSTGRES_PASSWORD`, `PAYMENTS_API_KEY`, `PAYMENT_WEBHOOK_SECRET` and `ORDER_ACCESS_SECRET`. The local defaults are for development only. Changing database password variables does not rotate passwords in an existing database volume. Use database administration to rotate existing credentials; do not delete volumes containing data you need.

### Webhook secret

Payment webhooks follow [Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks), and are signed and checked by its reference library, `standardwebhooks` 1.1.1. Both services need the same `PAYMENT_WEBHOOK_SECRET`: `whsec_` followed by 24 to 64 random bytes in base64. To make one:

```sh
node -e "console.log('whsec_' + require('node:crypto').randomBytes(32).toString('base64'))"
```

The key in `docker-compose.yml` is for local use only, so set your own for any deployment. [Checkout flow](docs/checkout-flow.md#2-delivering-a-result-the-webhook) explains how the signature, the retries and the reconciliation job fit together.

### Purchase quantity limit

Set `ORDER_MAX_QUANTITY_PER_PRODUCT=250` in `.env` to allow up to 250 units of each product per order, subject to stock and the payment amount limit. The default is 100. Recreate shop-api with your usual `docker compose up --build --wait` command (include the imports override if enabled), then reload the browser. A configuration-only change needs no frontend rebuild.

Startup accepts integers from 1 to 1,000,000; the upper bound is a technical input bound rather than a sales policy. Public `GET /api/orders/settings` supplies the current limit to the storefront, and the API checks it before reserving stock. Existing carts are preserved when the limit falls and must be adjusted before checkout; replaying an already-created order with its original idempotency key still returns that order. The separate limits of 50 distinct products per order and the maximum payment amount are unchanged.

### Object-storage imports

The opt-in MinIO/S3 import API accepts 5 MB by default, configurable to 10 MB with `IMPORT_MAX_FILE_BYTES` in `.env`. It processes files through a durable job and keeps the atomic review and apply. Start it with `docker compose -f docker-compose.yml -f docker-compose.imports.yml up --build --wait`. The direct upload endpoint remains limited to 1 MB. See [Object-storage imports](docs/large-imports.md) for local storage and validation limits.

## Admin accounts

Provisioning is an explicit command; starting the application, with or without the imports stack, never creates accounts. After building the application, copy `admins.example.yaml` to `admins.local.yaml`. Add up to 100 accounts with `name`, `email` and `passwordEnv`. Create `admins.local.env` with a matching entry such as `STORE_ADMIN_PASSWORD=your-chosen-long-password` (12–256 characters). Choose your own password; the example is not a preconfigured account. Both local files are ignored by Git and excluded from Docker builds. Restrict file access with `chmod 600 admins.local.yaml admins.local.env`.

```sh
docker compose -f docker-compose.yml -f docker-compose.admin.yml run --build --rm admin-provision
```

Alternatively, pass the password from your terminal instead of storing it in the environment file. Keep `passwordEnv: STORE_ADMIN_PASSWORD` in `admins.local.yaml`. The Compose configuration still requires `admins.local.env` to exist; `touch` creates it if missing without overwriting an existing file.

```sh
touch admins.local.env
chmod 600 admins.local.yaml admins.local.env
export STORE_ADMIN_PASSWORD='your-chosen-long-password'

docker compose -f docker-compose.yml -f docker-compose.admin.yml \
  run --build --rm -e STORE_ADMIN_PASSWORD admin-provision

unset STORE_ADMIN_PASSWORD
```

The explicit `-e` forwards the exported variable into the provisioning container and overrides that variable from `admins.local.env`. For several password variables, export each one and repeat `-e VARIABLE_NAME`. A password typed into a command may remain in your shell history; `unset` only removes it from the current shell environment.

The one-off service waits for database migrations, mounts the YAML read-only, and reads passwords from its environment. It validates the entire file before writing, hashes passwords with scrypt, and saves the batch in one transaction. Existing emails are skipped, preserving their names, passwords and active sessions. Every password reference must resolve, even for skipped entries. Accounts left out of the file are never deleted.

To deliberately replace existing names and passwords and revoke their sessions:

```sh
docker compose -f docker-compose.yml -f docker-compose.admin.yml run --build --rm admin-provision node dist/admin/provision-admins.js /config/admins.yaml --replace-existing
```

When running outside Docker, build shop-api first and run `pnpm --filter shop-api admin:provision /absolute/path/admins.local.yaml` with `DATABASE_URL` and the referenced password variables exported. The `admin:bootstrap` command creates or replaces a single account; unlike the YAML command's default behavior, it always replaces credentials and revokes sessions. There are no customer accounts or roles. Production secrets belong in a deployment secret store rather than local environment files.
