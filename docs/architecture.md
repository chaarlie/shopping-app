# Architecture

What runs when you start `docker compose up --build`. Solid arrows are built; dashed arrows are part of the checkout and are not built yet.

```mermaid
flowchart LR
    browser([Browser]) -->|"localhost:8080, the only published port"| nginx

    nginx -->|"/"| webapp["webapp<br/>Next.js"]
    nginx -->|"/api"| shop["shop-api<br/>NestJS"]

    subgraph internal ["Internal network"]
        migrate["shop-api-migrate<br/>runs once before shop-api"]
        paymentsMigrate["payments-api-migrate<br/>runs once before payments-api"]
        payments["payments-api<br/>NestJS"]
        postgres[("Postgres<br/>databases: shop, payments")]
    end

    migrate -->|"applies migrations"| postgres
    paymentsMigrate -->|"applies migrations"| postgres
    shop -->|"TypeORM, shop database only"| postgres
    payments -->|"TypeORM, payments database only"| postgres
    shop -.->|"planned: payment requests, with the service key"| payments
    payments -.->|"planned: signed webhooks with the results"| shop
```

- **Only nginx is published.** It serves the webapp at `/` and shop-api at `/api`.
- **Containers on the internal network can't be reached from your machine or the internet.** payments-api, Postgres and the migration runner are only on that network, and it has no internet access. shop-api is on both networks so nginx can reach it.
- **Each service has its own database and role.** Neither role can connect to the other service's database.
- **Migrations run before each API starts.** `shop-api-migrate` and `payments-api-migrate` apply them and exit, and each API starts only after its runner succeeds. TypeORM's `synchronize` is off.
- **The health checks include the database.** The container checks call shop-api's `/api/health/ready` and payments-api's `/health/ready`, which ping Postgres.
- **The two services will talk over HTTP in both directions.** shop-api asks payments-api for payments with the service key. payments-api reports each result by posting a signed event to shop-api's `/webhooks/payments`, a route outside `/api` that nginx never forwards. [Checkout flow](checkout-flow.md) has the details.
