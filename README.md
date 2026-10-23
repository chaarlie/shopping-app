# Shopping App

E-commerce code challenge: product CRUD, CSV import, product search and purchases with a simulated payment provider.

## Run locally

Requirements: Docker with Docker Compose v2.

```sh
docker compose up --build
```

Then open http://localhost:8080. The API is served under http://localhost:8080/api, and http://localhost:8080/api/health reports whether it is up.

## Example CSV

The example file provided with the challenge, `Code Challenge E-Commerce.csv`, was downloaded on **2026-10-20** from the challenge email.

It is stored unchanged at [`backend/Code Challenge E-Commerce.csv`](backend/Code%20Challenge%20E-Commerce.csv), and `.gitattributes` keeps git from converting its CRLF line endings. Its SHA-256 is `6fc46b84badb1ac37b8b19a2d0741aa7728d6c93a9fe949b19f676892dc8fd24`, which you can check with:

```sh
shasum -a 256 "backend/Code Challenge E-Commerce.csv"
```

## Design

- [Architecture](docs/architecture.md): the containers, what each one can reach, and what is built so far.
- [Product import](docs/product-import.md): how each CSV row is accepted, fixed or rejected.
- [Checkout flow](docs/checkout-flow.md): how shop-api and payments-api settle a purchase with signed webhooks and live updates, including declines, expired orders and late payments.

## Decisions

- **CSV import.** Rows that disagree about a SKU are rejected rather than guessed, products that already exist are updated, and stock is set rather than added, so importing the same file twice changes nothing. [Product import](docs/product-import.md#decisions) explains each choice and the alternatives.
- **Payment results.** payments-api reports each payment to shop-api as a signed webhook, sent from an outbox that retries until shop-api confirms, the way a payment gateway reports to a merchant. RabbitMQ between the services was the alternative. [Checkout flow](docs/checkout-flow.md#decisions) explains the choice.

## Known issues

[KNOWN_ISSUES.md](KNOWN_ISSUES.md) lists the problems found in the example CSV and how each one is handled, plus the known bugs and limitations of this solution.

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

`typecheck` covers the tests as well as the source, and needs `build` first so the shared packages are compiled. Both services' e2e tests start a throwaway Postgres container with Testcontainers, so Docker must be running.

To run a service outside Docker, use `pnpm --filter shop-api start:dev` or `pnpm --filter payments-api start:dev`. Both listen on port 3000 unless `PORT` is set, so give one of them another port to run both.

- `shop-api` needs `DATABASE_URL`, a Postgres connection URL. Apply migrations with `pnpm --filter shop-api build` followed by `pnpm --filter shop-api migration:run`.
- `payments-api` needs `PAYMENTS_API_KEY`, at least 32 characters, and `DATABASE_URL` for its own database. Apply its migrations the same way, with `pnpm --filter payments-api migration:run`. `PAYMENT_SETTLE_DELAY_MS` sets how long the simulated card provider takes to answer (2000 by default), and `BACKGROUND_JOBS=off` stops its workers, which the e2e tests use to run them step by step.
