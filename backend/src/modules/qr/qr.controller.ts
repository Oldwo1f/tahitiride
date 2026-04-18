import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QrService } from './qr.service';

@Controller('qr')
@UseGuards(JwtAuthGuard)
export class QrController {
  constructor(private readonly qr: QrService) {}

  @Get('driver')
  getDriverQr(@CurrentUser() user: AuthUser) {
    return this.qr.generateForDriver(user.id);
  }
}
