import type { Point } from 'geojson';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Direction } from '../common/types/direction.enum';
import { User } from './user.entity';

@Entity('driver_status')
export class DriverStatus {
  @PrimaryColumn({ type: 'uuid' })
  user_id!: string;

  @OneToOne(() => User, (u) => u.driver_status, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid', nullable: true })
  vehicle_id!: string | null;

  @Index()
  @Column({ type: 'boolean', default: false })
  is_online!: boolean;

  @Column({ type: 'enum', enum: Direction, nullable: true })
  direction!: Direction | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  destination!: string | null;

  @Index({ spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  current_position!: Point | null;

  @Column({ type: 'double precision', nullable: true })
  heading!: number | null;

  @Column({ type: 'double precision', nullable: true })
  speed!: number | null;

  @UpdateDateColumn()
  last_seen_at!: Date;
}
