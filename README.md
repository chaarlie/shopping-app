# Shopping App

E-commerce code challenge: product CRUD, CSV import, product search and purchases with a simulated payment provider.

## Run locally

Requirements: Docker with Docker Compose v2.

```sh
docker compose up --build
```

Then open http://localhost:8080. The API is served under http://localhost:8080/api, and http://localhost:8080/api/health reports whether it is up.

## Buying through the API

Until the checkout screens exist, a purchase can be made with curl. Payments only accept the simulated gateway's test cards:

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | Visa, approved |
| `5555 5555 5555 4444` | Mastercard, approved |
| `4000 0000 0000 0002` | Visa, declined |
| `4000 0000 0000 9995` | Visa, declined for insufficient funds |

```sh
curl -s -X POST localhost:8080/api/products -H 'Content-Type: application/json' \
  -d '{"sku":"RS-001","name":"Running Shoes","category":"Footwear","priceCents":8999,"stock":3}'

curl -s -c cookies.txt -X POST localhost:8080/api/orders -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"name":"Ada Lovelace","email":"ada@example.com","items":[{"productId":1,"quantity":1}],
       "card":{"number":"4242 4242 4242 4242","expMonth":12,"expYear":2030,"cvc":"123"}}'

curl -s -N -b cookies.txt localhost:8080/api/orders/<reference>/events
```

The order answers `pending_payment` at once. The stream then shows it paid about two seconds later, when the simulated provider answers and its webhook arrives. After a decline, `POST /api/orders/<reference>/payments` with another card and a new `Idempotency-Key` tries again.

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

- `shop-api` needs `DATABASE_URL`, a Postgres connection URL. Apply migrations with `pnpm --filter shop-api build` followed by `pnpm --filter shop-api migration:run`. For checkout it also needs `PAYMENTS_API_URL` and `PAYMENTS_API_KEY`, to reach payments-api, `PAYMENT_WEBHOOK_SECRET`, the same secret payments-api signs its webhooks with, and `ORDER_ACCESS_SECRET`, at least 32 characters, which signs the order access cookies. Set `ORDER_COOKIE_SECURE=false` when it isn't served over HTTPS.
- `payments-api` needs `PAYMENTS_API_KEY`, at least 32 characters, and `DATABASE_URL` for its own database. Apply its migrations the same way, with `pnpm --filter payments-api migration:run`. It also needs `PAYMENT_WEBHOOK_URL`, where it posts payment results, and `PAYMENT_WEBHOOK_SECRET`, in the Standard Webhooks format described below, which signs them. `PAYMENT_SETTLE_DELAY_MS` sets how long the simulated card provider takes to answer (2000 by default), and `BACKGROUND_JOBS=off` stops its workers, which the e2e tests use to run them step by step.

## Webhook authentication

Payment webhooks follow [Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks), and are signed and checked by its reference library, `standardwebhooks` 1.1.1. Both services need the same `PAYMENT_WEBHOOK_SECRET`: `whsec_` followed by 24 to 64 random bytes in base64. To make one:

```sh
node -e "console.log('whsec_' + require('node:crypto').randomBytes(32).toString('base64'))"
```

The key in `docker-compose.yml` is for local use only, so set your own for any deployment. [Checkout flow](docs/checkout-flow.md#2-delivering-a-result-the-webhook) explains how the signature, the retries and the reconciliation job fit together.
