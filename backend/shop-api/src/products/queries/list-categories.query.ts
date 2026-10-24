import { Query } from '@nestjs/cqrs';
import { CategoryList } from '@shop/contracts';

export class ListCategoriesQuery extends Query<CategoryList> {}
