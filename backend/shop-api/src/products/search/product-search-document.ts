export interface SearchableProduct {
  id: number;
  sku: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  version: number;
  createdAt: Date;
}

export interface ProductSearchDocument {
  id: number;
  sku: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  createdAt: string;
}

export interface ProductIndexChange {
  productId: number;
  version: number;
  document: ProductSearchDocument | null;
}

export interface QueuedProductChange {
  id: string;
  productId: number;
  version: number;
}

export function toSearchDocument(
  product: SearchableProduct,
): ProductSearchDocument {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    category: product.category,
    priceCents: product.priceCents,
    createdAt: product.createdAt.toISOString(),
  };
}

export function planIndexChanges(
  queued: QueuedProductChange[],
  products: SearchableProduct[],
): ProductIndexChange[] {
  const latestVersions = new Map<number, number>();

  for (const { productId, version } of queued) {
    latestVersions.set(
      productId,
      Math.max(version, latestVersions.get(productId) ?? 0),
    );
  }

  const current = new Map(products.map((product) => [product.id, product]));

  return [...latestVersions].map(([productId, version]) => {
    const product = current.get(productId);

    return product
      ? {
          productId,
          version: product.version,
          document: toSearchDocument(product),
        }
      : { productId, version, document: null };
  });
}
