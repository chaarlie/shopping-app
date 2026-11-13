# Stockroom frontend

Next.js route pages remain thin; feature components live under `src/app/components/{landing,catalog,checkout,admin}`. Shared browser utilities, typed API requests, cart storage and payment retry helpers live in `src/lib`.

`src/app/globals.css` defines the palette, semantic status colors, typography, spacing and radii. The Inter Tight font is self-hosted through `next/font/google`, which downloads it at build time, so an offline build would need a vendored, licensed copy.

The storefront uses real API data, category fallback images, URL-based search/filter/sort/pagination, product details, cart and simulated checkout. Product cards on the home page and catalog offer an accessible cart-icon button that adds one unit without navigating. The shared cart enforces stock and quantity limits; the button disables when unavailable or at the limit and announces the result.

Admin screens use a top navigation bar, product forms with version checks, and TanStack Table 9 editable import rows through typed table meta. Product names are always rendered as text.

Run `pnpm --filter webapp dev --port 3107`. Development forwards `/api` to `SHOP_API_ORIGIN` (default `http://localhost:8080`); production uses nginx. Start the Docker stack first. Configure `APP_ORIGIN` on shop-api to include the frontend origin.

`pnpm --filter webapp test` covers precise decimal conversion, cart persistence validation and payment key reuse. HTTP errors remain visible, edits reload on stale versions, and checkout retries preserve unknown outcomes.

## Component boundaries

- Route pages choose the feature component and pass route parameters.
- `catalog` owns browsing, search and product presentation. `CatalogFilters` renders the search form; `Catalog` owns URL state and fetching. Search remains submit-based.
- `checkout` owns cart, payment forms and order display. `useOrder` owns event subscriptions, polling, cancellation and version ordering.
- `admin` owns catalog management and import review. `useImportReview` owns mutations, validation, concurrency locks and reloads; `ImportTable` owns editable cell rendering.
- `useImportUpload` owns upload requests, cancellation, saved-session recovery and progress. `ImportUpload` renders the form; `ImportReviewFilters` renders controlled review filters without owning request state.
- `ui` contains reusable HTML primitives. `Button` preserves native props and refs, defaults to `type="button"`, and uses existing design-token classes; form submissions explicitly opt into `type="submit"`. Links remain links.
- Shared `lib` contains transport, formatting, persistence and input conversion; it does not own page markup.

## Manual checks

The automated tests don't drive a browser. Before a release, check these journeys at desktop and phone widths: sign-in, CSV import with edits, exclusions and history, create/edit/delete a product, duplicate SKU correction, stale edit reload, category/search/pagination, empty and error states, cart, a declined card and a successful retry.
