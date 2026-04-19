import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WalletTransactionType } from '../common/types/direction.enum';
import { Trip } from './trip.entity';
import { User } from './user.entity';
import { WalletRequest } from './wallet-request.entity';

@Entity('wallet_transactions')
@Index(['trip_id', 'type', 'user_id'], {
  unique: true,
  where: 'trip_id IS NOT NULL',
})
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'integer' })
  amount_xpf!: number;

  @Column({ type: 'enum', enum: WalletTransactionType })
  type!: WalletTransactionType;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  trip_id!: string | null;

  @ManyToOne(() => Trip, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'trip_id' })
  trip!: Trip | null;

  /**
   * For type='adjustment' rows: human-readable reason logged by the admin
   * who triggered the operation. Null for normal trip-driven flows.
   */
  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  /**
   * For type='adjustment' rows: id of the admin user who performed the
   * change. Null for normal trip-driven flows.
   */
  @Column({ type: 'uuid', nullable: true })
  actor_user_id!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_user_id' })
  actor!: User | null;

  /**
   * Set when this transaction was created by the admin approving a
   * `wallet_requests` row (deposit credit or payout debit). Null for
   * trip settlements and direct admin adjustments.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  wallet_request_id!: string | null;

  @ManyToOne(() => WalletRequest, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'wallet_request_id' })
  wallet_request!: WalletRequest | null;

  @CreateDateColumn()
  created_at!: Date;
}
