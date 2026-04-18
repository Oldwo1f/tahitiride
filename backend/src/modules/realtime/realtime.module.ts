import { Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module';
import { TripsModule } from '../trips/trips.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [LocationsModule, VehiclesModule, TripsModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
