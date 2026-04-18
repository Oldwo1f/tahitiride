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

@Entity('passenger_waits')
export class PassengerWait {
  @PrimaryColumn({ type: 'uuid' })
  user_id!: string;

  @OneToOne(() => User, (u) => u.passenger_wait, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Index()
  @Column({ type: 'boolean', default: false })
  is_waiting!: boolean;

  @Column({ type: 'enum', enum: Direction, nullable: true })
  direction!: Direction | null;

  @Index({ spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  position!: Point | null;

  @UpdateDateColumn()
  updated_at!: Date;
}
