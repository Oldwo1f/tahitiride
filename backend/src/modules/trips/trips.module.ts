import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trip } from '../../entities/trip.entity';
import { TripPoint } from '../../entities/trip-point.entity';
import { LocationsModule } from '../locations/locations.module';
import { MapboxModule } from '../mapbox/mapbox.module';
import { PricingModule } from '../pricing/pricing.module';
import { QrModule } from '../qr/qr.module';
import { WalletModule } from '../wallet/wallet.module';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, TripPoint]),
    QrModule,
    LocationsModule,
    MapboxModule,
    PricingModule,
    WalletModule,
  ],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
