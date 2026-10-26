# Saved import review

An authenticated administrator uploads a CSV of at most 1 MB. Extract parses it, Transform normalizes and validates each row, Stage stores the original bytes and row results, Review records corrections and exclusions, and Load applies valid rows in one transaction. The preview is paginated on the server, 15 rows at a time; history includes uploader, applier, timestamps and counts.

Conflicting SKUs block Load until the administrator excludes duplicate choices or changes the values. Other invalid rows remain quarantined and are skipped. No SKU is generated. Repeated application cannot duplicate catalog writes. Existing stock is preserved unless explicitly opted in; negative file stock becomes zero with a retained shortfall warning.

The import version protects concurrent review edits. A scoped fingerprint protects only included SKUs and their catalog fields: identity, name, description, category, price and weight, plus stock only when stock replacement is enabled. Unrelated catalog activity and stock-only sales under the default preservation policy do not invalidate the preview. Applying locks matching product rows in ID order, reads their current stock, compares the fingerprint and loads in the same transaction. Concurrent creation of a missing SKU returns 409 through the unique constraint. Previews saved with the previous fingerprint format need one explicit refresh before applying.

Files remain in Postgres because the limit is 1 MB. Edits are separate append-only audit records, with admin and timestamp; the original bytes never change. Larger files would belong in object storage with a background staging worker. Malformed files are retained with a file-level error and cannot be applied; admins can download and correct them. Empty files and uploads exceeding the 1 MB limit are refused at the boundary.

Endpoints are under `/api/admin/imports`: POST uploads; GET lists history; GET `/:id` previews; PATCH `/:id/rows/:row` edits/excludes; POST `/:id/refresh` refreshes the comparison; POST `/:id/apply` loads; GET `/:id/file` downloads the unchanged original as an attachment.

The import integration tests cover immutable originals, audit records, stale edits, catalog conflicts, duplicate decisions, stock preservation, opt-in replacement, negative stock and pagination. Authentication tests cover protected writes, public storefront reads, logout/expiry, origin checks and rate limiting.

Import persistence now exposes named operations rather than arbitrary SQL to handlers. Both import entry points share the ProductImportWriter and versioned product repository. Preview results use one conditional batch update so unchanged rows are not rewritten.

Upload, edit, refresh and apply use separate transactional commands and handlers. Shared review preparation validates import versions, loads only matching catalog SKUs and persists changed results through the repository.
