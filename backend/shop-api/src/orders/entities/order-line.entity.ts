import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'order_lines' })
export class OrderLineEntity {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'order_id', type: 'integer' })
  orderId: number;

  @Column({ name: 'product_id', type: 'integer', nullable: true })
  productId: number | null;

  @Column({ type: 'text' })
  sku: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'unit_price_cents', type: 'integer' })
  unitPriceCents: number;

  @Column({ type: 'integer' })
  quantity: number;
}
