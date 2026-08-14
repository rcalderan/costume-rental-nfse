import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type FiscalDocumentStatus =
  | 'PENDING'
  | 'SIGNED'
  | 'TRANSMITTED'
  | 'AUTHORIZED'
  | 'REJECTED'
  | 'CANCELLED';

@Entity('fiscal_documents')
export class FiscalDocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 10 })
  type!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: FiscalDocumentStatus;

  @Column({ type: 'int', nullable: true })
  model?: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  series?: string;

  @Column({ type: 'bigint', nullable: true })
  number?: string;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  accessKey?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  protocol?: string;

  @Column({ type: 'timestamptz', nullable: true })
  authorizationDate?: Date;

  @Column({ type: 'varchar', nullable: true })
  customerName?: string;

  @Column({ type: 'varchar', nullable: true })
  customerEmail?: string;

  @Column({ type: 'varchar', nullable: true })
  customerDocument?: string;

  @Column({ type: 'timestamptz' })
  issueDate!: Date;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  totalValue!: number;

  @Column({ type: 'text', nullable: true })
  signedXml?: string;

  @Column({ type: 'text', nullable: true })
  authorizedXml?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectionReason?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  cancelReason?: string;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt?: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  cancelProtocol?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
