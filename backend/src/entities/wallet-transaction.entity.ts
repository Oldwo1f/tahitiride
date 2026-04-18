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

  @CreateDateColumn()
  created_at!: Date;
}
