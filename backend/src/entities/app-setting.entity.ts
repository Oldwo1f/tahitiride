import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Key-value store for runtime-tunable settings (pricing, distance limits,
 * initial wallet balance...). Acts as an overlay over `app.config.ts`: when
 * a row is present, its value wins; otherwise we fall back to env / default.
 *
 * Values are stored as JSONB so we can hold numbers, strings or richer
 * structures without extra columns.
 */
@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key!: string;

  @Column({ type: 'jsonb' })
  value!: unknown;

  @UpdateDateColumn()
  updated_at!: Date;

  @Column({ type: 'uuid', nullable: true })
  updated_by_user_id!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updated_by_user_id' })
  updated_by!: User | null;
}
