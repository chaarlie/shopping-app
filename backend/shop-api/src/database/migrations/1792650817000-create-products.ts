import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProducts1792650817000 implements MigrationInterface {
  name = 'CreateProducts1792650817000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE products (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        sku text NOT NULL,
        name text NOT NULL,
        description text NOT NULL DEFAULT '',
        category text NOT NULL,
        price_cents integer NOT NULL,
        stock integer NOT NULL,
        weight_grams integer,
        version integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT products_sku_key UNIQUE (sku),
        CONSTRAINT products_price_cents_check CHECK (price_cents > 0),
        CONSTRAINT products_stock_check CHECK (stock >= 0),
        CONSTRAINT products_weight_grams_check CHECK (weight_grams >= 0)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX products_category_idx ON products (category)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE products');
  }
}
