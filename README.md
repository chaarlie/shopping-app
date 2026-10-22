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

- [Checkout flow](docs/checkout-flow.md): how shop-api, payments-api and RabbitMQ settle a purchase, including declines, expired orders and late payments.

## Development

Requirements: Node.js 24 and pnpm 10.28.

```sh
pnpm install
pnpm -r lint
pnpm -r build
pnpm -r test
pnpm --filter shop-api --filter payments-api test:e2e
```

To run a service outside Docker, use `pnpm --filter shop-api start:dev` or `pnpm --filter payments-api start:dev`. Both listen on port 3000 unless `PORT` is set, so give one of them another port to run both. `payments-api` also needs a `PAYMENTS_API_KEY` environment variable of at least 32 characters.
