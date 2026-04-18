import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('wallets')
export class Wallet {
  @PrimaryColumn({ type: 'uuid' })
  user_id!: string;

  @OneToOne(() => User, (u) => u.wallet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'integer', default: 0 })
  balance_xpf!: number;

  @UpdateDateColumn()
  updated_at!: Date;
}
