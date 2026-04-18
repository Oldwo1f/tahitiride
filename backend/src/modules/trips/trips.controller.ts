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
import { DropoffDto, PickupDto } from './dto/pickup.dto';
import { TripsService } from './trips.service';

@Controller('trips')
@UseGuards(JwtAuthGuard)
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Post('pickup')
  pickup(@CurrentUser() user: AuthUser, @Body() dto: PickupDto) {
    return this.trips.pickup(user.id, dto);
  }

  @Post(':id/dropoff')
  dropoff(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DropoffDto,
  ) {
    return this.trips.dropoff(user.id, id, dto);
  }

  @Get('active')
  active(@CurrentUser() user: AuthUser) {
    return this.trips.findActive(user.id);
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
