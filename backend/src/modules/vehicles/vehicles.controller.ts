import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CertificationsService } from '../certifications/certifications.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
@UseGuards(JwtAuthGuard)
export class VehiclesController {
  constructor(
    private readonly vehicles: VehiclesService,
    private readonly certifications: CertificationsService,
  ) {}

  @Get('mine')
  listMine(@CurrentUser() user: AuthUser) {
    return this.vehicles.listMine(user.id);
  }

  /**
   * Sends the photo to the OCR backend so the driver onboarding wizard
   * can pre-fill the form. Stateless — the photo is only persisted by
   * `POST /vehicles/mine` once the user confirms the data.
   */
  @Post('photo/analyze')
  @UseInterceptors(FileInterceptor('file'))
  analyzePhoto(@UploadedFile() file: Express.Multer.File) {
    return this.certifications.analyzeVehiclePhoto(file);
  }

  @Post('mine')
  @UseInterceptors(FileInterceptor('photo'))
  createMine(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateVehicleDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return this.vehicles.createMine(user.id, dto, photo);
  }

  @Delete('mine/:id')
  deleteMine(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vehicles.deleteMine(user.id, id);
  }
}
