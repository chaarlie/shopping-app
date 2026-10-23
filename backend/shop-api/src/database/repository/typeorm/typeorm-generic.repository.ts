import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import {
  DeepPartial,
  EntityTarget,
  FindOptionsWhere,
  QueryDeepPartialEntity,
  Repository,
} from 'typeorm';
import {
  GenericRepository,
  Identifiable,
} from '../generic/generic-repository.abstract.js';

export abstract class TypeOrmGenericRepository<
  T extends Identifiable,
  TCreate = Omit<T, 'id'>,
> implements GenericRepository<T, TCreate> {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly entity: EntityTarget<T>,
  ) {}

  protected get repository(): Repository<T> {
    return this.txHost.tx.getRepository(this.entity);
  }

  findAll(): Promise<T[]> {
    return this.repository.find();
  }

  findById(id: number): Promise<T | null> {
    return this.repository.findOneBy({ id } as FindOptionsWhere<T>);
  }

  create(data: TCreate): Promise<T> {
    return this.repository.save(this.repository.create(data as DeepPartial<T>));
  }

  async update(id: number, changes: Partial<TCreate>): Promise<T | null> {
    await this.repository.update(id, changes as QueryDeepPartialEntity<T>);
    return this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const { affected } = await this.repository.delete(id);
    return affected === 1;
  }
}
