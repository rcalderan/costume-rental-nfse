import { MigrationInterface, QueryRunner } from 'typeorm';

export class PersistDpsState1789257600000 implements MigrationInterface {
  name = 'PersistDpsState1789257600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "nfse_dps_counters" (
        "cnpj" varchar(14) NOT NULL,
        "series" varchar(10) NOT NULL,
        "last_number" bigint NOT NULL,
        PRIMARY KEY ("cnpj", "series")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "nfse_retry_events" (
        "id" varchar(100) PRIMARY KEY,
        "payload" jsonb NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "nfse_retry_events"');
    await queryRunner.query('DROP TABLE "nfse_dps_counters"');
  }
}
