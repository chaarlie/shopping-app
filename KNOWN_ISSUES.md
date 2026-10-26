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

That adds up to 86 products imported, 9 rows rejected and 2 blank rows skipped. In the saved portal, correct or exclude rows before applying. Applied imports are immutable: further corrections require a new upload. Existing stock is preserved by default.

## Known bugs and limitations

- **Administrators must be provisioned before catalog writes.** Product mutations require a valid admin session. The saved import portal requires the same session.
- **Concurrent catalog changes require a fresh import preview.** A duplicate SKU created during loading returns 409 and rolls back the whole import. Existing stock is preserved unless the admin explicitly opts into updating it.
- **Flagged payment events have no screen yet.** shop-api answers 200 for a webhook it records but can't apply, such as an amount that doesn't match its order or a second successful payment for an order that is already paid, so payments-api stops resending it. Those events are logged as errors and kept in `processed_payment_events` with the outcome `flagged` and the reason, and a person has to look them up there and refund or fix the order by hand.
- **A guest order opens only in the browser that placed it.** The access token lives in an httpOnly cookie, and nothing sends the customer a link or an email, so clearing cookies or switching devices loses access to the order page. The order itself is unaffected.
- **Search matching lags product edits by about a second.** The indexer runs every second, so a renamed product is found under its new name a moment later. The price and stock a search shows are always current, because they are read back from Postgres.
- **Search matches the start of words, not the middle.** `runn` finds Running Shoes and `unning` doesn't. Matching inside words would need full n-grams and a much larger index.
- **A short search with a word no product has finds nothing.** Every word of a one- or two-word search has to be found, so `wireless headphones` finds nothing in the example catalog rather than listing the wireless products. There is no fallback to a looser search yet.
- **Search pages stop at the first 10,000 results,** OpenSearch's default window. Going further would need `search_after` paging.
- **The search index isn't ready for a cluster yet.** It has no replicas, which suits the single local node, and OpenSearch runs without its security plugin. On Amazon OpenSearch Service, the index needs at least one replica and requests need HTTPS with SigV4 signing, which the client supports but which isn't wired up.

- **Cancelled orders with unresolved attempts remain eligible for reconciliation.** They are rechecked no more than once per minute after a successful lookup; this favors recovery over silently abandoning an unknown payment. A larger deployment would need an explicit operational retention and investigation policy.

- **Import review usability:** errors and actions are grouped together, with explicit duplicate labels and a needs-attention shortcut. Desktop and phone visual acceptance of this refinement remains with the user. Difference highlights compare rows on the current page; large duplicate groups may span pages.

- **Admin orders:** guest names and email addresses are supplied at checkout, not verified identities. The page shows order placement time, not payment settlement time. Browser acceptance remains with the user. Quarantined import rows remain accessible through each import’s Needs attention filter; applied imports are read-only and corrections require another upload.

- **Local configuration:** direct service ports require the debug Compose override and bind only to localhost. Custom hostnames require APP_ORIGIN. Database password variables initialize new volumes; they do not rotate existing roles.

- **Admin provisioning:** YAML is an explicit account creation/replacement input, not continuous synchronization. Removing an entry does not delete the account. Existing accounts are skipped unless --replace-existing is supplied. Local password files are plaintext and must remain private; they are excluded from Git and image build contexts.

- **Fixed import row mapping:** emptying an earlier staged row could shift later validation results and original quarantine checks to the wrong record. Replanning now maps by parsed row number. Previously applied imports are not rewritten; any history produced by the old behavior should be checked against its original file and the catalog.

- Import edit refreshes now preserve the mounted table and draft text. A row may still leave the current view after a save if it no longer matches the selected status or SKU filter. Browser acceptance is pending.

Import persistence now exposes named operations rather than arbitrary SQL to handlers. Both import entry points share the ProductImportWriter and versioned product repository. Preview results use one conditional batch update so unchanged rows are not rewritten.
