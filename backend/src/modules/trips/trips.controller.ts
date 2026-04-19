import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EstimateDto } from './dto/estimate.dto';
import { DropoffPositionDto, PickupDto } from './dto/pickup.dto';
import { TripsService } from './trips.service';

@Controller('trips')
@UseGuards(JwtAuthGuard)
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Post('estimate')
  estimate(@Body() dto: EstimateDto) {
    return this.trips.estimate(dto);
  }

  @Post('pickup')
  pickup(@CurrentUser() user: AuthUser, @Body() dto: PickupDto) {
    return this.trips.pickup(user.id, dto);
  }

  /** Passenger asks to step out — driver still has to confirm. */
  @Post(':id/dropoff-request')
  requestDropoff(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DropoffPositionDto,
  ) {
    return this.trips.requestDropoff(user.id, id, dto);
  }

  /** Driver confirms (or initiates) the end of a trip. */
  @Post(':id/complete')
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DropoffPositionDto,
  ) {
    return this.trips.completeByDriver(user.id, id, dto);
  }

  @Get('active')
  active(@CurrentUser() user: AuthUser) {
    return this.trips.findActive(user.id);
  }

  /** All passengers currently riding with this driver. */
  @Get('active-passengers')
  activePassengers(@CurrentUser() user: AuthUser) {
    return this.trips.listActiveAsDriver(user.id);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.trips.listMine(user.id, limit ? parseInt(limit, 10) : 20);
  }

  @Get(':id')
  byId(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.trips.findById(id, user.id);
  }
}
