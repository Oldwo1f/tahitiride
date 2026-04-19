import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAction } from '../../entities/admin-action.entity';
import { Trip } from '../../entities/trip.entity';
import { TripPoint } from '../../entities/trip-point.entity';
import { User } from '../../entities/user.entity';
import { Vehicle } from '../../entities/vehicle.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { Wallet } from '../../entities/wallet.entity';
import { AdminController } from './admin.controller';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminAuditService } from './services/admin-audit.service';
import { AdminSettingsService } from './services/admin-settings.service';
import { AdminTripsService } from './services/admin-trips.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminVehiclesService } from './services/admin-vehicles.service';
import { AdminWalletsService } from './services/admin-wallets.service';
import { BootstrapAdminService } from './services/bootstrap-admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Wallet,
      WalletTransaction,
      Trip,
      TripPoint,
      Vehicle,
      AdminAction,
    ]),
  ],
  controllers: [AdminController],
  providers: [
    AdminAuditService,
    AdminUsersService,
    AdminWalletsService,
    AdminTripsService,
    AdminVehiclesService,
    AdminSettingsService,
    AdminAnalyticsService,
    BootstrapAdminService,
  ],
  exports: [BootstrapAdminService],
})
export class AdminModule {}
