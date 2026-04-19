import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Certification } from './certification.entity';
import { User } from './user.entity';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => User, (u) => u.vehicles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 16 })
  plate!: string;

  @Column({ type: 'varchar', length: 80 })
  model!: string;

  @Column({ type: 'varchar', length: 40 })
  color!: string;

  @Column({ type: 'varchar', length: 128 })
  qr_secret!: string;

  /**
   * Relative path under the upload root (e.g. `vehicles/<uuid>.jpg`) of
   * the 3/4-face photo captured during the driver onboarding wizard.
   * Served by `GET /api/uploads/vehicles/<filename>` (any authenticated
   * user — passengers need to recognise the car arriving). Nullable so
   * legacy creation paths and seeded fixtures keep working.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  photo_path!: string | null;

  /**
   * Denormalised cache of the latest approved insurance certification
   * status, kept in sync by `CertificationsService` and the daily cron
   * that flips expired vignettes back to `false`.
   */
  @Column({ type: 'boolean', default: false })
  is_certified!: boolean;

  @Column({ type: 'date', nullable: true })
  certified_until!: string | null;

  @OneToMany(() => Certification, (c) => c.vehicle)
  certifications?: Certification[];

  @CreateDateColumn()
  created_at!: Date;
}
