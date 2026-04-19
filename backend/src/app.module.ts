import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import mapboxConfig from './config/mapbox.config';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { LocationsModule } from './modules/locations/locations.module';
import { MapboxModule } from './modules/mapbox/mapbox.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { QrModule } from './modules/qr/qr.module';
import { RealtimeBusModule } from './modules/realtime-bus/realtime-bus.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SettingsModule } from './modules/settings/settings.module';
import { TripsModule } from './modules/trips/trips.module';
import { UsersModule } from './modules/users/users.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { WalletModule } from './modules/wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, mapboxConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions =>
        config.get<TypeOrmModuleOptions>('database')!,
    }),
    SettingsModule,
    RealtimeBusModule,
    AuthModule,
    UsersModule,
    VehiclesModule,
    WalletModule,
    LocationsModule,
    QrModule,
    MapboxModule,
    PricingModule,
    TripsModule,
    RealtimeModule,
    AdminModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
