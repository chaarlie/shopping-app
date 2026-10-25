import { createProductSchema, updateProductSchema } from '@shop/contracts';
export function decimalUnits(raw: string, places: number): number {
  const match = new RegExp(`^(\\d+)(?:\\.(\\d{1,${places}}))?$`).exec(
    raw.trim(),
  );
  if (!match) {
    throw new Error(
      `Enter a non-negative number with at most ${places} decimal places.`,
    );
  }
  return (
    Number(match[1]) * 10 ** places +
    Number((match[2] || '').padEnd(places, '0'))
  );
}
export function productFromForm(form: FormData, version?: number) {
  const weight = String(form.get('weight') || '').trim();
  const fields = {
    name: String(form.get('name')),
    description: String(form.get('description') || ''),
    category: String(form.get('category')),
    priceCents: decimalUnits(String(form.get('price')), 2),
    stock: Number(form.get('stock')),
    weightGrams: weight ? decimalUnits(weight, 3) : null,
  };
  return version === undefined
    ? createProductSchema.parse({ ...fields, sku: String(form.get('sku')) })
    : updateProductSchema.parse({ ...fields, version });
}
