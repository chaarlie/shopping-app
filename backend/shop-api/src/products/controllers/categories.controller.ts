import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { CategoryList } from '@shop/contracts';
import { ListCategoriesQuery } from '../queries/list-categories.query.js';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  list(): Promise<CategoryList> {
    return this.queryBus.execute(new ListCategoriesQuery());
  }
}
