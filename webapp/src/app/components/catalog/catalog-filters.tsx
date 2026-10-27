import Link from 'next/link';
import { Button } from '../ui/button';

type CatalogFiltersProps = {
  query: string;
  category: string;
  sort: string;
  categories: { name: string; productCount: number }[];
  onSearch: (values: Record<string, string>) => void;
};

export function CatalogFilters({
  query,
  category,
  sort,
  categories,
  onSearch,
}: CatalogFiltersProps) {
  return (
    <form
      className="catalog-toolbar"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSearch({
          q: String(data.get('q') || '').trim(),
          category: String(data.get('category') || ''),
          sort: String(data.get('sort') || ''),
        });
      }}
    >
      <label>
        Search
        <input
          name="q"
          type="search"
          maxLength={100}
          defaultValue={query || ''}
          placeholder="Product name or SKU"
        />
      </label>
      <label>
        Category
        <select name="category" defaultValue={category || ''}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.productCount})
            </option>
          ))}
        </select>
      </label>
      <label>
        Sort
        <select name="sort" defaultValue={sort || ''}>
          <option value="">Recommended</option>
          <option value="relevance">Relevance</option>
          <option value="name">Name</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="newest">Newest</option>
        </select>
      </label>
      <Button variant="primary" type="submit">
        Search
      </Button>
      <Link className="btn-grey" href="/shop">
        Clear
      </Link>
    </form>
  );
}
