export interface StockLine {
  productId: number | null;
  quantity: number;
}

export interface StockProduct {
  id: number;
  stock: number;
}

export function stockCoversLines(
  lines: StockLine[],
  products: StockProduct[],
): boolean {
  const stock = new Map(products.map((product) => [product.id, product.stock]));

  return lines.every(
    (line) =>
      line.productId !== null &&
      (stock.get(line.productId) ?? 0) >= line.quantity,
  );
}
