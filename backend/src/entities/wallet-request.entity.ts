import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  WalletRequestStatus,
  WalletRequestType,
} from '../common/types/direction.enum';
import { User } from './user.entity';

/**
 * A user-initiated request to move money in or out of their wallet.
 *
 * - `type='deposit'`: the user declared they made a bank transfer to the
 *   platform's IBAN. Pending until an admin checks the bank statement and
 *   credits the wallet.
 *
 * - `type='payout'`: a driver asks the platform to wire `amount_xpf` from
 *   their wallet to their personal IBAN. Pending until an admin actually
 *   makes the bank transfer and debits the wallet.
 *
 * Status moves through `pending` → (`approved` | `rejected` | `cancelled`)
 * exactly once. Idempotency is enforced in code (lock + status check).
 */
@Entity('wallet_requests')
@Index(['user_id', 'created_at'])
@Index(['status', 'type', 'created_at'])
export class WalletRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'enum', enum: WalletRequestType })
  type!: WalletRequestType;

  @Column({
    type: 'enum',
    enum: WalletRequestStatus,
    default: WalletRequestStatus.PENDING,
  })
  status!: WalletRequestStatus;

  @Column({ type: 'integer' })
  amount_xpf!: number;

  /**
   * IBAN where the platform must wire the funds (payouts only). Stored
   * as the user typed it minus internal whitespace; admins read it
   * verbatim when initiating the transfer.
   */
  @Column({ type: 'varchar', length: 34, nullable: true })
  iban!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  account_holder_name!: string | null;

  /** Free-text reference the user used on the bank transfer (deposits). */
  @Column({ type: 'text', nullable: true })
  user_note!: string | null;

  /** Optional explanation written by the admin when approving / rejecting. */
  @Column({ type: 'text', nullable: true })
  admin_note!: string | null;

  @Column({ type: 'uuid', nullable: true })
  processed_by_user_id!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'processed_by_user_id' })
  processed_by!: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  processed_at!: Date | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
