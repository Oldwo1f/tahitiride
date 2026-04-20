import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserRole } from '../common/types/direction.enum';
import { Certification } from './certification.entity';
import { Vehicle } from './vehicle.entity';
import { Wallet } from './wallet.entity';
import { DriverStatus } from './driver-status.entity';
import { PassengerWait } from './passenger-wait.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone!: string | null;

  /**
   * Bcrypt hash of the local password. Nullable because a user signing
   * in via Facebook for the first time has no local password — the
   * `login()` flow rejects empty/null hashes upfront so this never
   * weakens email/password authentication.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  password_hash!: string | null;

  /**
   * Stable Facebook user id (returned by Graph API `/me?fields=id`).
   * A partial unique index in the migration guarantees one Facebook
   * account maps to at most one local user.
   */
  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  facebook_id!: string | null;

  /**
   * Display name kept as a denormalised cache so the existing modules
   * (admin lists, realtime, audit) keep working without joins. Always
   * recomputed from `first_name + ' ' + last_name` when the profile
   * is updated.
   */
  @Column({ type: 'varchar', length: 120 })
  full_name!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  first_name!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  last_name!: string | null;

  /**
   * Relative path under the upload root (e.g. `avatars/<uuid>.png`).
   * Served by `GET /api/uploads/avatars/:filename` (auth-protected).
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar_path!: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  /**
   * Independent driver-mode flag. Any authenticated user (including
   * admins) can flip it from their profile — it controls whether the
   * driver-only UI (vehicles, license upload, map driver view,
   * payouts) is available. Decoupled from `role`, which is reserved
   * for back-office access control.
   */
  @Column({ type: 'boolean', default: false })
  is_driver!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  suspended_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;

  @OneToMany(() => Vehicle, (v) => v.user)
  vehicles!: Vehicle[];

  @OneToMany(() => Certification, (c) => c.user)
  certifications?: Certification[];

  @OneToOne(() => Wallet, (w) => w.user)
  wallet?: Wallet;

  @OneToOne(() => DriverStatus, (d) => d.user)
  driver_status?: DriverStatus;

  @OneToOne(() => PassengerWait, (p) => p.user)
  passenger_wait?: PassengerWait;
}
