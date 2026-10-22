export interface Identifiable {
  id: number;
}

export abstract class GenericRepository<
  T extends Identifiable,
  TCreate = Omit<T, 'id'>,
> {
  abstract findAll(): Promise<T[]>;

  abstract findById(id: number): Promise<T | null>;

  abstract create(data: TCreate): Promise<T>;

  abstract update(id: number, changes: Partial<TCreate>): Promise<T | null>;

  abstract delete(id: number): Promise<boolean>;
}
