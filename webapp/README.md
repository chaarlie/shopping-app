# Stockroom frontend

Next.js route pages remain thin; feature components live under `src/app/components/{landing,catalog,checkout,admin}`. Shared browser utilities, typed API requests, cart storage and payment retry helpers live in `src/lib`. This follows the feature-oriented structure of Henrik's Apartments.

`src/app/globals.css` defines the Design D palette, semantic status colors, typography, spacing and radii. Inter Tight matches the mockup; `next/font/google` self-hosts it after downloading at build time. Offline builds would need a vendored licensed font.

The storefront uses real API data, category fallbacks, URL-based search/filter/sort/pagination, product details, cart and simulated checkout. Admin screens use a top navigation bar, product forms with version checks, and TanStack Table 9 editable import rows through typed table meta. Product names are always rendered as text.

Run `pnpm --filter webapp dev --port 3107`. Development forwards `/api` to `SHOP_API_ORIGIN` (default `http://localhost:8080`); production uses nginx. Start the Docker stack first. Configure `APP_ORIGIN` on shop-api to include the frontend origin.

`pnpm --filter webapp test` covers precise decimal conversion, cart persistence validation and payment key reuse. Full browser journeys and responsive layouts must also be checked. HTTP errors remain visible, edits reload on stale versions, and checkout retries preserve unknown outcomes.

## Component boundaries

- Route pages choose the feature component and pass route parameters.
- `catalog` owns browsing, search and product presentation. `CatalogFilters` renders the search form; `Catalog` owns URL state and fetching. Search remains submit-based.
- `checkout` owns cart, payment forms and order display. `useOrder` owns event subscriptions, polling, cancellation and version ordering.
- `admin` owns catalog management and import review. `useImportReview` owns mutations, validation, concurrency locks and reloads; `ImportTable` owns editable cell rendering.
- `useImportUpload` owns upload requests, cancellation, saved-session recovery and progress. `ImportUpload` renders the form; `ImportReviewFilters` renders controlled review filters without owning request state.
- `ui` contains reusable HTML primitives. `Button` preserves native props and refs, defaults to `type="button"`, and uses existing design-token classes; form submissions explicitly opt into `type="submit"`. Links remain links.
- Shared `lib` contains transport, formatting, persistence and input conversion; it does not own page markup.

Manual acceptance checks (user-owned): create/edit/delete a product, duplicate SKU correction, stale edit reload, import edits/exclusions and history, category/search/pagination, empty/error states, and desktop/phone layouts. The browser pass already confirmed sign-in, challenge CSV import, exact SKU search, cart, decline and successful retry. No further automated browser interaction is required by the user.
