import type { Point } from 'geojson';
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
import { TripStatus } from '../common/types/direction.enum';
import { TripPoint } from './trip-point.entity';
import { User } from './user.entity';
import { Vehicle } from './vehicle.entity';

@Entity('trips')
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  passenger_id!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'passenger_id' })
  passenger!: User;

  @Index()
  @Column({ type: 'uuid' })
  driver_id!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'driver_id' })
  driver!: User;

  @Column({ type: 'uuid' })
  vehicle_id!: string;

  @ManyToOne(() => Vehicle, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle!: Vehicle;

  @Index()
  @Column({ type: 'enum', enum: TripStatus, default: TripStatus.ACTIVE })
  status!: TripStatus;

  @CreateDateColumn()
  started_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  ended_at!: Date | null;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  start_point!: Point | null;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  end_point!: Point | null;

  @Column({ type: 'double precision', nullable: true })
  distance_m!: number | null;

  @Column({ type: 'integer', nullable: true })
  fare_xpf!: number | null;

  @Column({ type: 'varchar', length: 128 })
  pickup_token_jti!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  dropoff_token_jti!: string | null;

  @OneToMany(() => TripPoint, (tp) => tp.trip)
  points!: TripPoint[];
}
