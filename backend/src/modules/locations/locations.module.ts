import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverStatus } from '../../entities/driver-status.entity';
import { PassengerWait } from '../../entities/passenger-wait.entity';
import { LocationsService } from './locations.service';

@Module({
  imports: [TypeOrmModule.forFeature([DriverStatus, PassengerWait])],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
