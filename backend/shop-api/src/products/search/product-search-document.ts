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
