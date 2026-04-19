import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/types/direction.enum';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AdjustWalletDto } from './dto/adjust-wallet.dto';
import { AuditListQueryDto } from './dto/audit-list-query.dto';
import { CancelTripDto } from './dto/cancel-trip.dto';
import { ListQueryDto } from './dto/list-query.dto';
import { TripsListQueryDto } from './dto/trips-list-query.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UsersListQueryDto } from './dto/users-list-query.dto';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminAuditService } from './services/admin-audit.service';
import { AdminSettingsService } from './services/admin-settings.service';
import { AdminTripsService } from './services/admin-trips.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminVehiclesService } from './services/admin-vehicles.service';
import { AdminWalletsService } from './services/admin-wallets.service';

interface VehiclesListQueryExt extends ListQueryDto {
  userId?: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly analytics: AdminAnalyticsService,
    private readonly users: AdminUsersService,
    private readonly wallets: AdminWalletsService,
    private readonly trips: AdminTripsService,
    private readonly vehicles: AdminVehiclesService,
    private readonly settings: AdminSettingsService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get('overview')
  overview() {
    return this.analytics.overview();
  }

  @Get('users')
  listUsers(@Query() query: UsersListQueryDto) {
    return this.users.list(query);
  }

  @Get('users/:id')
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.getOne(id);
  }

  @Patch('users/:id/role')
  updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.updateRole(id, dto.role, actor.id);
  }

  @Post('users/:id/suspend')
  @HttpCode(200)
  suspendUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.setSuspended(id, true, actor.id);
  }

  @Post('users/:id/unsuspend')
  @HttpCode(200)
  unsuspendUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.setSuspended(id, false, actor.id);
  }

  @Delete('users/:id')
  deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.softDelete(id, actor.id);
  }

  @Get('wallets')
  listWallets(@Query() query: ListQueryDto) {
    return this.wallets.list(query);
  }

  @Get('wallets/:userId')
  getWallet(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.wallets.getOne(userId);
  }

  @Post('wallets/:userId/adjust')
  @HttpCode(200)
  adjustWallet(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AdjustWalletDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.wallets.adjust({
      userId,
      deltaXpf: dto.deltaXpf,
      reason: dto.reason,
      actorId: actor.id,
    });
  }

  @Get('trips')
  listTrips(@Query() query: TripsListQueryDto) {
    return this.trips.list(query);
  }

  @Get('trips/:id')
  getTrip(@Param('id', ParseUUIDPipe) id: string) {
    return this.trips.getOne(id);
  }

  @Get('trips/:id/points')
  async getTripPoints(@Param('id', ParseUUIDPipe) id: string) {
    const line = await this.trips.getPointsAsLineString(id);
    return { trip_id: id, geometry: line };
  }

  @Post('trips/:id/cancel')
  @HttpCode(200)
  cancelTrip(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelTripDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.trips.cancel(id, dto.reason, actor.id);
  }

  @Get('vehicles')
  listVehicles(@Query() query: VehiclesListQueryExt) {
    return this.vehicles.list(query);
  }

  @Delete('vehicles/:id')
  deleteVehicle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.vehicles.remove(id, actor.id);
  }

  @Get('settings')
  listSettings() {
    return this.settings.list();
  }

  @Patch('settings/:key')
  updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.settings.update(key, dto.value, actor.id);
  }

  @Get('audit')
  listAudit(@Query() query: AuditListQueryDto) {
    return this.audit.list(query);
  }
}
