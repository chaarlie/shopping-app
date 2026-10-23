import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { ConflictError, NotFoundError } from '../../../common/errors.js';
import { ProductEntity } from '../../entities/product.entity.js';
import { ProductRepository } from '../../repositories/product.repository.js';
import { UpdateProductCommand } from '../update-product.command.js';

@CommandHandler(UpdateProductCommand)
export class UpdateProductCommandHandler implements ICommandHandler<UpdateProductCommand> {
  constructor(private readonly products: ProductRepository) {}

  @Transactional()
  async execute({ id, input }: UpdateProductCommand): Promise<ProductEntity> {
    const { version, ...changes } = input;
    const updated = await this.products.updateIfVersionMatches(
      id,
      version,
      changes,
    );

    if (updated) {
      return updated;
    }

    if (await this.products.findById(id)) {
      throw new ConflictError(
        `Product ${id} changed since version ${version}. Reload it and try again.`,
      );
    }

    throw new NotFoundError(`Product ${id} was not found`);
  }
}
