import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
@UseGuards(JwtAuthGuard)
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get('mine')
  listMine(@CurrentUser() user: AuthUser) {
    return this.vehicles
      .listMine(user.id)
      .then((list) => list.map(({ qr_secret: _, ...rest }) => (void _, rest)));
  }

  @Post('mine')
  createMine(@CurrentUser() user: AuthUser, @Body() dto: CreateVehicleDto) {
    return this.vehicles
      .createMine(user.id, dto)
      .then(({ qr_secret: _, ...rest }) => (void _, rest));
  }

  @Delete('mine/:id')
  deleteMine(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vehicles.deleteMine(user.id, id);
  }
}
