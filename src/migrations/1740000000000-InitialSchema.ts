import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1740000000000 implements MigrationInterface {
  name = 'InitialSchema1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fiscal_documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" varchar(10) NOT NULL,
        "status" varchar(20) NOT NULL,
        "model" int,
        "series" varchar(10),
        "number" bigint,
        "accessKey" varchar(50) UNIQUE,
        "protocol" varchar(50),
        "authorizationDate" timestamptz,
        "customerName" varchar,
        "customerEmail" varchar,
        "customerDocument" varchar,
        "issueDate" timestamptz NOT NULL,
        "totalValue" numeric(14,2) NOT NULL,
        "signedXml" text,
        "authorizedXml" text,
        "rejectionReason" varchar(500),
        "cancelReason" varchar(500),
        "cancelledAt" timestamptz,
        "cancelProtocol" varchar(50),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "fiscal_documents"`);
  }
}
