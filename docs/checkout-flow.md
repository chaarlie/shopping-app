# Checkout flow

This is the design the checkout is being built to, and this page changes in the same commits as the code.

**Status:** everything on this page is built in shop-api and payments-api, and [What the design guarantees](#what-the-design-guarantees) lists the test that proves each guarantee. The webapp's checkout screens are not built yet.

payments-api plays the part of a payment gateway, and shop-api is the merchant. Requests go one way: shop-api asks payments-api to charge a card. Results come back the other way as signed webhooks, which is how gateways such as Stripe and Adyen report payments to merchants.

## 1. Placing an order and paying

```mermaid
sequenceDiagram
    autonumber
    actor B as Browser
    participant S as shop-api
    box payments-api
        participant P as payments API
        participant PR as simulated card provider
        participant W as webhook sender
    end

    B->>S: POST /api/orders with cart, contact and test card (Idempotency-Key K1)
    Note over S: One transaction. Price the cart from the database,<br/>take the stock only if enough is left,<br/>save the order as pending_payment, due in 15 min.
    S->>P: POST /payments with order reference, amount and test card<br/>(service key, Idempotency-Key reference:K1, 5 s timeout)
    Note over P: One transaction. Save the payment as processing.<br/>One processing or succeeded payment per order.
    P-->>S: 202 processing
    S-->>B: 201 pending_payment, with the order reference,<br/>and the access token in an httpOnly cookie
    B->>S: GET /api/orders/:reference/events (SSE)
    S-->>B: pending_payment
    P-)PR: charge the test card
    PR-)P: approved or declined
    Note over P,W: One transaction. Save the result and its outbox event.
    W->>S: POST /webhooks/payments, payment.succeeded or payment.failed, signed
    Note over S: One transaction. Record the event id,<br/>apply it to the order, notify the open streams.
    S-->>W: 200 after the commit
    S-)B: paid, or payment declined

    opt the card was declined
        B->>S: POST /api/orders/:reference/payments with another test card (Idempotency-Key K2)
        Note over B,W: The same path from the payment request on, with the new key.<br/>The stock stays reserved until the order is due.
    end
```

- **Each payment attempt has its own Idempotency-Key.** Sending the same request again, after a timeout or a double click, returns the first answer and never charges twice. A retry after a decline is a new attempt with a new key, because the old key would only replay the decline. shop-api puts the order reference in front of the browser's key before passing it to payments-api, so one order's keys can never collide with another's.
- **The access token proves the order is yours.** shop-api sends it as an httpOnly cookie that only that order's routes receive, so page scripts can't read it and the browser sends it with the stream by itself. The order reference is shown on screen and in links, so on its own it proves nothing.
- **The stock is taken when the order is placed,** so an order that gets paid always has its items. An order nobody pays for returns its stock when it's due (section 4).
- **shop-api calls payments-api after its own transaction commits,** never inside it. A timeout means the outcome is unknown: the order stays pending, and a retry with the same key picks up the same payment.

## 2. Delivering a result: the webhook

```mermaid
sequenceDiagram
    autonumber
    participant W as webhook sender (payments-api)
    participant PDB as payments database
    participant S as shop-api, POST /webhooks/payments
    participant SDB as shop database

    Note over W,PDB: Every second, claim the events that are due, with a 30 s lease<br/>(FOR UPDATE SKIP LOCKED), so two senders never take the same one.
    W->>S: the event, signed with the webhook secret
    Note over W,S: Standard Webhooks: webhook-id, webhook-timestamp, webhook-signature<br/>v1,base64 HMAC-SHA256 of id.timestamp.body<br/>Each attempt is signed again with a fresh timestamp.
    alt bad signature, or a timestamp more than 5 min old
        S-->>W: 401
    else valid
        S->>SDB: One transaction. Insert the event id into processed_payment_events.
        alt the event id is already there
            Note over S,SDB: A repeat. Nothing else changes.
        else a new event
            S->>SDB: Apply it to the order, guarded by status, and pg_notify.
        end
        S-->>W: 200 after the commit
    end
    alt 2xx
        W->>PDB: mark the event delivered and log the attempt
    else a timeout, 5xx or 401
        W->>PDB: log the attempt and schedule the next one, after 5 s, then 30 s
        Note over W,PDB: After the third attempt the event is marked dead.<br/>The reconciliation job still settles the order by asking payments-api.
    end
```

- **A crash can't lose a result.** payments-api saves each result and its event in one transaction, the outbox, and the sender tries three times to deliver it.
- **Three attempts are enough.** Most failures are short, such as shop-api restarting. If all three fail, the reconciliation job finds the payment within about a minute (section 4).
- **Repeats change nothing.** shop-api records the event id in the same transaction as the change.
- **2xx means "recorded".** shop-api answers 2xx only after its transaction commits. It also answers 2xx for an event it records but can't apply, such as an amount that doesn't match the order or an unknown order, and flags it for a person to check. Only temporary failures, such as the database being down, answer 5xx, so that retrying can help.
- **Only payments-api can send results.** The signature covers the event id, the attempt's timestamp and the exact body, so nobody without the secret can forge or change an event. A timestamp more than five minutes off is refused, so an old request can't be replayed, and the signed id must match the event id in the body. The route sits outside `/api`, so nginx never forwards it, and shop-api checks the signature anyway.
- **Each direction has its own secret.** The service key lets shop-api call payments-api, and the webhook secret signs payments-api's events. Leaking one doesn't give away the other.
- **The sender runs inside payments-api,** started when the app boots and stopped on shutdown. Several instances can run it at once, because each one only sends the events it has leased.
- **The receiver is set in config.** payments-api reads its URL and the webhook secret from the environment, and shop-api reads the same secret. Both are checked at startup.

## 3. Live status over SSE

```mermaid
sequenceDiagram
    autonumber
    actor B as Browser
    participant S1 as shop-api instance 1
    participant S2 as shop-api instance 2
    participant PG as Postgres

    S1->>PG: LISTEN order_updates, on one dedicated connection
    S2->>PG: LISTEN order_updates, on one dedicated connection
    B->>S1: GET /api/orders/:reference/events (access token cookie)
    Note over S1: Register the stream first, then read the order,<br/>so no change can slip in between.
    S1->>PG: read the order
    S1-->>B: status pending_payment
    Note over S2: The webhook lands on instance 2.
    S2->>PG: One transaction. Update the order and pg_notify('order_updates', reference)
    PG-)S1: the order reference, once the transaction commits
    PG-)S2: the order reference, once the transaction commits
    S1->>PG: read the order again
    S1-->>B: status paid, sent only if newer than the last event
    Note over B,S1: A heartbeat every 20 s keeps proxies from closing the stream.<br/>It ends at a final status, or after 10 min, and the browser<br/>reconnects and reads the order again.
```

- **Only committed changes reach the browser.** Postgres delivers a notification only when its transaction commits.
- **Every instance hears every change,** and passes it only to the streams for that order. Nothing is broadcast to every browser or replayed from memory.
- **The notification carries only the order reference.** The stream reads the order from the database, so a reconnect or a missed notification fixes itself on the next read. If the `LISTEN` connection drops, the instance reconnects and reads the order again for every open stream.
- **nginx doesn't buffer the stream.** If the stream can't connect, the browser polls `GET /api/orders/:reference` instead.

## 4. When no result arrives

```mermaid
sequenceDiagram
    autonumber
    participant S as shop-api
    participant P as payments-api
    actor B as Browser

    loop reconciliation job, every minute
        Note over S: Find pending_payment orders that are due,<br/>or whose payment has been processing for over a minute.
        S->>P: GET /payments?orderReference=... (service key, 5 s timeout)
        alt payments-api can't be reached, or a payment is still processing
            Note over S: Leave the order pending and ask again next time.<br/>Not knowing isn't the same as not paid.
        else a payment succeeded
            Note over S: One transaction. Mark the order paid.<br/>The webhook changes nothing when it arrives.
            S-)B: paid
        else the order is due and no payment succeeded
            Note over S: One transaction. Cancel the order and return its stock.
            S-)B: cancelled
        else a payment failed and its webhook never arrived
            Note over S: One transaction. Record the decline, as the webhook would have.
            S-)B: payment declined
        end
    end

    opt a payment succeeds after its order was cancelled
        P->>S: payment.succeeded webhook
        alt the stock is still there
            Note over S: One transaction. Take the stock again and mark the order paid.
            S-)B: paid
        else the stock is gone
            Note over S: Mark the order refund_pending.
            S->>P: POST /payments/:id/refunds (service key, Idempotency-Key from the payment id)
            P-->>S: refunded
            Note over S: Mark the order refunded.
            S-)B: refunded
        end
    end
```

- **A lost webhook costs about a minute.** The job checks payments that have been processing for over a minute, not only orders that are due.
- **A crash between saving the order and calling payments-api** ends here too: no payment is found, so the order is cancelled when it's due and its stock returned.
- **A refund is retried with the same key until payments-api confirms it,** so a customer is never refunded twice.
- **One gap remains.** If a payment succeeds after its order was cancelled and all three deliveries of its webhook fail, shop-api never hears of it, because the job only checks pending orders. It's rare, and it needs a manual refund.

## Order states

```mermaid
stateDiagram-v2
    [*] --> pending_payment: order placed, stock taken
    pending_payment --> pending_payment: declined, the customer can retry
    pending_payment --> paid: a payment succeeded
    pending_payment --> cancelled: due without a successful payment, stock returned
    cancelled --> paid: late payment, stock still there
    cancelled --> refund_pending: late payment, stock gone
    refund_pending --> refunded: payments-api confirms the refund
    paid --> [*]
    refunded --> [*]
```

`paid` and `refunded` are final, and `cancelled` is final unless a late payment arrives. Every change is a single `UPDATE` guarded by the current status, so a late or repeated event can't move an order backwards.

## What the design guarantees

- **No overselling.** Taking the stock and creating the order happen in one transaction in shop-api, and the stock is taken only if enough is left.
- **No double charge.** A repeated request reuses its Idempotency-Key and gets the first answer, and payments-api allows one processing or succeeded payment per order, whatever the key.
- **No lost or repeated results, with one exception.** payments-api saves each result and its webhook event in one transaction and tries three times to deliver it. shop-api answers only after its own transaction commits and drops repeats by event id, and the reconciliation job settles pending orders whose webhook never arrived. The exception is a late payment for a cancelled order whose three deliveries all fail (section 4).
- **No forged results.** shop-api applies a result only with a valid signature and a recent timestamp, on a route nginx never forwards.
- **No stuck orders.** The reconciliation job asks payments-api before cancelling, and a payment that succeeds after cancellation gets its stock back or is refunded.
- **The browser never sets the amount.** shop-api prices the cart from the database. payments-api accepts only calls that carry the service key, and it is reachable only inside the Docker network.

Each guarantee has a test that was seen failing against a broken version of the code:

| Guarantee | Test | Broken version it catches |
|---|---|---|
| No overselling | `orders.e2e-spec.ts`: "sells the last unit to only one of two buyers checking out at once" | the row lock and the stock condition both removed |
| No double charge | `payments.e2e-spec.ts` in payments-api: "allows only one active payment per order, whatever the keys" | the partial unique index made non-unique |
| No lost or repeated results | `payment-webhooks.e2e-spec.ts`: "applies an event once, however often it is delivered"; `webhooks.e2e-spec.ts` in payments-api: retries, dead events and the lease | the event id dedupe removed; the lease check removed |
| No forged results | `payment-webhooks.e2e-spec.ts`: "refuses an event that is unsigned, signed with another secret, old or changed"; `webhook-signature` unit tests | a failed verification treated as valid |
| No stuck orders | `reconciliation.e2e-spec.ts`: cancelling due orders, finding lost webhooks, refunds, and "cancels nothing while payments-api cannot be reached" | an unreachable payments-api treated as "no payments" |
| The browser never sets the amount | `orders.spec.ts` in contracts: "refuses a price sent by the browser"; `orders.e2e-spec.ts`: the order is priced from the database | |

## Decisions

- **Webhook signatures follow Standard Webhooks.** `@shop/webhook-signature` wraps `standardwebhooks` 1.1.1, the spec's reference library. Each delivery carries `webhook-id` (the event id, the same on every retry), `webhook-timestamp` and `webhook-signature` (`v1,` and a base64 HMAC-SHA256 of `<id>.<timestamp>.<raw body>`). The receiver accepts several signatures, so the secret can be changed without downtime, and the sender signs with one.
  - *Our own Stripe-style format* was about 80 lines, but it was a protocol we would have had to maintain and explain. A published spec with a maintained library is easier to trust and to integrate with.

- **Payment results come back as signed webhooks, not through a message broker.** payments-api behaves like a real payment gateway: it knows a URL and a secret, not what an order is, and it retries until shop-api confirms or three attempts fail, and the reconciliation job covers what the retries miss. The outbox keeps every result safe, the way a broker would.
  - *RabbitMQ between the services* was the first design. It holds events while shop-api is down, but the outbox already does that. It adds a service to run locally and on AWS, and it redelivers a failed message straight away, so waiting between retries needs extra queues.
  - *shop-api polling payments-api* is simpler still, but results arrive late and every pending order costs a request. The reconciliation job keeps a version of it as the safety net.
- **One Idempotency-Key per payment attempt, not per order.** A key per order would make the first decline permanent, because every retry would replay it. payments-api still allows one processing or succeeded payment per order, whatever the key, so a new key can't charge twice.
- **Three delivery attempts, not days of retries.** Most failures are short, and the reconciliation job finds whatever the retries miss within about a minute. *Retrying for up to three days, as Stripe does,* would only help the rare late payment for a cancelled order.
- **The access token travels in an httpOnly cookie.** The browser's `EventSource` can't send headers, and a cookie is sent by itself and can't be read by page scripts. *A token in the URL* was the alternative, but URLs end up in logs and browser history.
- **The access token is an HMAC of the order reference, made with a server secret.** shop-api stores nothing it would have to keep secret, and a repeated checkout request gets the same token back, so a double click can't leave the browser holding a token that no longer works. The cost is that a token can't be revoked without changing the secret, which is acceptable for guest orders.
- **One receiver, set in config.** Real gateways let merchants register their own webhook endpoints, but there is only one merchant here.

### Webhook retry test timing

The sender marks an event dead after three failed deliveries. Its e2e test asserts each claimed delivery, checks that attempts one and two remain live, and checks that attempt three marks the event dead. Test fixtures explicitly make settlement due using the database clock and webhook delivery due using the application clock. Mixing Postgres `now()` precision with JavaScript millisecond timestamps previously allowed a loop iteration to claim nothing. A regression test holds the application clock behind the database clock to reproduce that boundary without sleeps.

Payment settlement e2e fixtures explicitly set processing payments due using the database clock before running the worker. A test holds the application clock one minute ahead, preventing host/container clock differences from skipping settlement and causing unrelated listing/refund assertions to fail. Production settlement scheduling is unchanged.
