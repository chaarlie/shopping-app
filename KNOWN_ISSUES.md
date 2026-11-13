# Known issues

This file lists how the import handles each problem row in the sample CSV, and the known bugs and limitations of the project. Each entry says what happens today.

## Problems in the sample CSV

[`backend/sample-data/products.csv`](backend/sample-data/products.csv) has rows that are broken on purpose. The import handles each one as shown below, and [Product import](docs/product-import.md) explains the rules and the reasons behind them. Row numbers count the header as row 1, as a spreadsheet does, and [`plan-product-import.spec.ts`](backend/shop-api/src/products/import/plan-product-import.spec.ts) checks every row listed here.

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

That adds up to 86 products imported, 9 rows rejected and 2 blank rows skipped. In the saved review, correct or exclude rows before applying. Applied imports are read-only, so further corrections need a new upload. Existing stock is preserved by default.

## Known bugs and limitations

### Payments and orders

- **Payments use a simulated provider.** payments-api picks each outcome from a published test card number and never contacts a bank. The note on [`CreatePaymentCommandHandler`](backend/payments-api/src/payments/commands/handlers/create-payment-command.handler.ts) describes what a real provider integration would change.
- **Flagged payment events have no screen yet.** shop-api answers 200 for a webhook it records but can't apply, such as an amount that doesn't match its order or a second successful payment for an order that is already paid, so payments-api stops resending it. Those events are logged as errors and kept in `processed_payment_events` with the outcome `flagged` and the reason, and a person has to look them up there and refund or fix the order by hand.
- **A guest order opens only in the browser that placed it.** The access token lives in an httpOnly cookie, and nothing sends the customer a link or an email, so clearing cookies or switching devices loses access to the order page. The order itself is unaffected.
- **Cancelled orders with unresolved payment attempts stay in reconciliation.** They are checked again at most once a minute after a successful lookup, which favors recovering an unknown payment over abandoning it. A larger deployment would need a policy for how long to keep checking and when to investigate.
- **Guest details are self-reported.** The admin orders view shows the name and email typed at checkout, not verified identities, and the time an order was placed, not when its payment settled.
- **The storefront learns a new purchase quantity limit on reload.** The server always enforces the current `ORDER_MAX_QUANTITY_PER_PRODUCT` for new orders. Cart quantities above a lowered limit are kept and flagged rather than silently reduced. If the settings request fails, adding to the cart and checking out stay disabled until a retry succeeds.

### Catalog and imports

- **Catalog writes need a provisioned admin.** Product changes and the saved import review require an admin session, and there is no sign-up; see [Admin accounts](README.md#admin-accounts).
- **Concurrent catalog changes require a fresh import preview.** Applying compares only the included SKUs and the fields the import would change, so stock-only sales don't block the default stock-preserving import. A relevant edit, a product deleted and recreated, or a SKU created by another write returns 409 and rolls back the whole import.
- **Duplicate comparison covers the current page.** Difference highlights compare the rows on the page being viewed, and a large group of duplicates can span pages.
- **A saved row can leave a filtered view.** After a save, a row that no longer matches the selected status or SKU filter disappears from the current view.
- **Quarantined rows stay inside their import.** They're reachable through each import's "Needs attention" filter, not from a separate list.
- **Object-storage imports are bounded.** They accept 5 MB by default, configurable up to 10 MB, and at most 20,000 records. Processing reads the bounded file in memory; it isn't a streaming pipeline for arbitrarily large files. Completed originals are kept until a retention policy is introduced. MinIO is built from pinned, archived upstream source for local use; a deployment should use a maintained S3 service.

### Search

- **Search matching lags product edits by about a second.** The indexer runs every second, so a renamed product is found under its new name a moment later. The price and stock a search shows are always current, because they are read back from Postgres.
- **Search matches the start of words, not the middle.** `runn` finds Running Shoes and `unning` doesn't. Matching inside words would need full n-grams and a much larger index.
- **A short search with a word no product has finds nothing.** Every word of a one- or two-word search has to be found, so `wireless headphones` finds nothing in the sample catalog rather than listing the wireless products. There is no fallback to a looser search yet.
- **Search pages stop at the first 10,000 results,** OpenSearch's default window. Going further would need `search_after` paging.
- **The search index isn't ready for a cluster yet.** It has no replicas, which suits the single local node, and OpenSearch runs without its security plugin. On Amazon OpenSearch Service, the index needs at least one replica and requests need HTTPS with SigV4 signing, which the client supports but which isn't wired up.

### Configuration and operations

- **Direct service ports need the debug override.** They're published only with `docker-compose.debug.yml`, and only on localhost. Custom hostnames require `APP_ORIGIN`. Database password variables initialize new volumes; they don't rotate existing roles.
- **Admin provisioning isn't a sync.** The YAML file creates or replaces accounts; removing an entry doesn't delete the account. Existing accounts are skipped unless `--replace-existing` is given. Local password files are plain text and must stay private; they're excluded from Git and from image build contexts.
