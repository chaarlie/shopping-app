import { Query } from '@nestjs/cqrs';
import type { ProductPage } from '@shop/contracts';
export class ListAdminProductsQuery extends Query<ProductPage> {
  constructor(
    public readonly page: number,
    public readonly pageSize: number,
    public readonly q: string,
    public readonly reorder: boolean,
  ) {
    super();
  }
}
