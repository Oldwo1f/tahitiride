import {
  Controller,
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
import { CertificationsService } from './certifications.service';

/**
 * Driver-facing endpoints. License submissions are scoped to the
 * authenticated user; insurance submissions take an explicit
 * `:vehicleId` and the service verifies ownership.
 */
@Controller('certifications')
@UseGuards(JwtAuthGuard)
export class CertificationsController {
  constructor(private readonly certs: CertificationsService) {}

  @Get('me')
  getMine(@CurrentUser() user: AuthUser) {
    return this.certs.getMine(user.id);
  }

  @Post('license')
  @UseInterceptors(FileInterceptor('file'))
  submitLicense(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.certs.submitLicense(user.id, file);
  }

  @Post('vehicle/:vehicleId/insurance')
  @UseInterceptors(FileInterceptor('file'))
  submitInsurance(
    @CurrentUser() user: AuthUser,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.certs.submitInsurance(user.id, vehicleId, file);
  }
}
