# Checkout flow

This is the design the checkout is being built to. It is not implemented yet, and this page will change in the same commits as the code.

```mermaid
sequenceDiagram
    autonumber
    actor B as Browser
    participant S as shop-api
    box payments-api
        participant P as payments API
        participant PR as simulated card provider
    end
    participant MQ as RabbitMQ

    B->>S: POST /api/orders with cart, contact and test card (Idempotency-Key)
    Note over S: One transaction. Price the cart from the database, take the stock only if enough is left, create the order as pending_payment, due in 15 min.
    S->>P: POST /payments with orderId, amount and test card (Bearer service key, same Idempotency-Key, 5 s timeout)
    Note over P: One transaction. Save the payment as processing. One in-progress or successful payment per order.
    P-->>S: 202 processing
    S-->>B: 201 order pending_payment
    B->>S: GET /api/orders/:id/events (SSE)
    S-->>B: current status pending_payment
    P-)PR: charge the test card

    alt card approved
        PR-)P: approved
        Note over P: One transaction. Payment succeeded and an outbox row.
        P-)MQ: payment.succeeded
        MQ-)S: payment.succeeded
        Note over S: One transaction. Record the event id, check the amount, mark the order paid. Ack only after commit.
        S-)B: paid
    else card declined
        PR-)P: declined
        Note over P: One transaction. Payment failed and an outbox row.
        P-)MQ: payment.failed
        MQ-)S: payment.failed
        Note over S: The order stays pending_payment. The customer can retry with a new key until it is due.
        S-)B: payment declined
    else no result before the order is due
        Note over S: Expiry job. Ask payments before cancelling anything.
        S->>P: GET /payments?orderId=:id (Bearer service key)
        P-->>S: payments for the order
        Note over S: One transaction. Paid if a payment succeeded, otherwise cancel the order and return the stock.
        S-)B: paid or expired
    else approved after the order was cancelled
        PR-)P: approved
        P-)MQ: payment.succeeded
        MQ-)S: payment.succeeded
        Note over S: The order is already cancelled. Take the stock again if it is still there, otherwise refund.
        S->>P: POST /payments/:id/refunds (Bearer service key, Idempotency-Key)
        S-)B: paid or refunded
    end
```

## What the design guarantees

- **No overselling.** Taking the stock and creating the order happen in one transaction in shop-api, and the stock is taken only if enough is left.
- **No double charge.** The browser's Idempotency-Key follows the request into payments-api, which allows one in-progress or successful payment per order.
- **No lost payment results.** payments-api saves each result and its event in one transaction, through an outbox, and shop-api acknowledges a message only after its own transaction commits. Repeated messages are dropped by event id.
- **No stuck orders.** The expiry job asks payments-api before cancelling, and a payment that succeeds after cancellation gets its stock back or is refunded.
- **The browser never sets the amount.** shop-api prices the cart from the database. payments-api accepts only calls that carry the service key, and it is reachable only inside the Docker network.
