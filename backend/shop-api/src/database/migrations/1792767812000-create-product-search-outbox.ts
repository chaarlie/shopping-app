import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductSearchOutbox1792767812000 implements MigrationInterface {
  name = 'CreateProductSearchOutbox1792767812000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE product_search_outbox (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        product_id integer NOT NULL,
        version integer NOT NULL,
        locked_until timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE FUNCTION queue_product_search_change() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          INSERT INTO product_search_outbox (product_id, version)
          VALUES (OLD.id, OLD.version + 1);
          RETURN OLD;
        END IF;

        INSERT INTO product_search_outbox (product_id, version)
        VALUES (NEW.id, NEW.version);
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER products_queue_search_change
        AFTER INSERT OR DELETE OR UPDATE OF name, description, category, price_cents
        ON products
        FOR EACH ROW
        EXECUTE FUNCTION queue_product_search_change()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER products_queue_search_change ON products',
    );
    await queryRunner.query('DROP FUNCTION queue_product_search_change()');
    await queryRunner.query('DROP TABLE product_search_outbox');
  }
}
