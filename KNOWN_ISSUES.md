# Known issues

This file lists the problems found in the example CSV and the known bugs and limitations of this solution. Each entry says what happens today.

## Problems in the example CSV

The example file has rows that look deliberately broken. The import handles each one as shown below, and [Product import](docs/product-import.md) explains the rules and the reasons behind them. Row numbers count the header as row 1, as a spreadsheet does, and [`plan-product-import.spec.ts`](backend/shop-api/src/products/import/plan-product-import.spec.ts) checks every row listed here.

| Rows | SKU | Problem | Result |
|---|---|---|---|
| 2, 36 | RS-001 | Two "Running Shoes" rows with different descriptions, prices and stock | Both rows rejected |
| 11, 56, 89 | BS-021 | Row 56 has a different description, price, stock and weight; row 89 repeats row 11 | All three rows rejected |
| 7 | YM-015 | Price is `free` | Rejected |
| 16 | DL-007 | Stock is `-5` | Imported as 0 with a shortfall warning |
| 25 | HD-099 | Name is blank | Rejected |
| 41 | WS-001 | Name is only spaces | Rejected |
| 47 | MB-001 | Price is `0.00` | Rejected |
| 4 | WM-042 | Price is `$29.99` | Imported at 29.99, with a warning |
| 50 | GK-088 | Weight is blank | Imported without a weight, with a warning |
| 52 | GC-025 | Category is blank, weight is `0` and stock is 99999 | Imported as Uncategorized, with a warning |
| 20 | XS-001 | Name is `<script>alert('xss')</script>` | Imported, with the name stored as text |
| 29 | SQL-001 | Name is `Robert'); DROP TABLE products;--` | Imported, with the name stored as text |
| 53 | CI-001 | Name contains a comma | Imported as written |
| 59 | QI-001 | Name contains double quotes | Imported as written |
| 31 | WB-033 | Description contains `—` and `™` | Imported as written |
| 51 | VC-001 | Stock is 0 | Imported as out of stock |
| 55, 68 | RS-050, BS-099 | Same names as RS-001 and BS-021 | Imported as separate products, because the SKU identifies a product |
| 62, 63 | | Blank rows | Skipped and counted |

That adds up to 86 products imported, 9 rows rejected and 2 blank rows skipped. To bring in the rejected rows, fix them and import the whole file again: the 86 products already imported are reported as unchanged.

## Known bugs and limitations

- **Administrators must be provisioned before catalog writes.** Product mutations require a valid admin session. The saved import portal is introduced separately.
- **Concurrent catalog changes require a fresh import preview.** A duplicate SKU created during loading returns 409 and rolls back the whole import. Existing stock is preserved unless the admin explicitly opts into updating it.
- **Flagged payment events have no screen yet.** shop-api answers 200 for a webhook it records but can't apply, such as an amount that doesn't match its order or a second successful payment for an order that is already paid, so payments-api stops resending it. Those events are logged as errors and kept in `processed_payment_events` with the outcome `flagged` and the reason, and a person has to look them up there and refund or fix the order by hand.
- **A late payment can be missed if all its webhooks fail.** If a payment succeeds after its order was cancelled, and all three deliveries of its webhook fail, shop-api never hears of it, because the reconciliation job only asks about pending orders. The customer is charged for a cancelled order, and the dead event in payments-api's `outbox_events` is the only trace. It needs the order to be cancelled within the seconds a payment is processing, and shop-api to be down for the next 35 seconds. There is no command to resend a dead event yet.
- **A guest order opens only in the browser that placed it.** The access token lives in an httpOnly cookie, and nothing sends the customer a link or an email, so clearing cookies or switching devices loses access to the order page. The order itself is unaffected.
- **Search matching lags product edits by about a second.** The indexer runs every second, so a renamed product is found under its new name a moment later. The price and stock a search shows are always current, because they are read back from Postgres.
- **Search matches the start of words, not the middle.** `runn` finds Running Shoes and `unning` doesn't. Matching inside words would need full n-grams and a much larger index.
- **A short search with a word no product has finds nothing.** Every word of a one- or two-word search has to be found, so `wireless headphones` finds nothing in the example catalog rather than listing the wireless products. There is no fallback to a looser search yet.
- **Search pages stop at the first 10,000 results,** OpenSearch's default window. Going further would need `search_after` paging.
- **The search index isn't ready for a cluster yet.** It has no replicas, which suits the single local node, and OpenSearch runs without its security plugin. On Amazon OpenSearch Service, the index needs at least one replica and requests need HTTPS with SigV4 signing, which the client supports but which isn't wired up.
