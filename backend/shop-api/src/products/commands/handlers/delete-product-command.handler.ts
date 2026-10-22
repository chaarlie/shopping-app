import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { NotFoundError } from '../../../common/errors.js';
import { ProductRepository } from '../../repositories/product.repository.js';
import { DeleteProductCommand } from '../delete-product.command.js';

@CommandHandler(DeleteProductCommand)
export class DeleteProductCommandHandler
  implements ICommandHandler<DeleteProductCommand>
{
  constructor(private readonly products: ProductRepository) {}

  @Transactional()
  async execute({ id }: DeleteProductCommand): Promise<void> {
    if (!(await this.products.delete(id))) {
      throw new NotFoundError(`Product ${id} was not found`);
    }
  }
}
