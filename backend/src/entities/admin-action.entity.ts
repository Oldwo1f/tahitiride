import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Append-only audit log of every privileged action taken from the back-office
 * (wallet adjustments, role changes, suspensions, deletions, settings edits,
 * trip cancellations, vehicle removals). Never deleted, never updated.
 */
@Entity('admin_actions')
@Index(['actor_user_id', 'created_at'])
@Index(['action', 'created_at'])
export class AdminAction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  actor_user_id!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actor_user_id' })
  actor!: User;

  /** Dotted action key (e.g. `wallet.adjust`, `user.role.update`). */
  @Column({ type: 'varchar', length: 64 })
  action!: string;

  @Column({ type: 'varchar', length: 32 })
  target_type!: string;

  @Column({ type: 'uuid', nullable: true })
  target_id!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload!: Record<string, unknown>;

  @CreateDateColumn()
  created_at!: Date;
}
