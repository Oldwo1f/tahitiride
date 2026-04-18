import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserRole } from '../common/types/direction.enum';
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

  @Column({ type: 'varchar', length: 255 })
  password_hash!: string;

  @Column({ type: 'varchar', length: 120 })
  full_name!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.BOTH })
  role!: UserRole;

  @CreateDateColumn()
  created_at!: Date;

  @OneToMany(() => Vehicle, (v) => v.user)
  vehicles!: Vehicle[];

  @OneToOne(() => Wallet, (w) => w.user)
  wallet?: Wallet;

  @OneToOne(() => DriverStatus, (d) => d.user)
  driver_status?: DriverStatus;

  @OneToOne(() => PassengerWait, (p) => p.user)
  passenger_wait?: PassengerWait;
}
