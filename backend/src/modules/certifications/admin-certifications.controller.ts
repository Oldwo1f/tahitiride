import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/types/direction.enum';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CertificationsService } from './certifications.service';
import { AdminCertificationListQueryDto } from './dto/admin-list-query.dto';
import { ApproveCertificationDto } from './dto/approve-certification.dto';
import { RejectCertificationDto } from './dto/reject-certification.dto';

/**
 * Admin-side certification queue. Mounted under `/api/admin/certifications`
 * to keep the routing convention used by the rest of the back-office.
 */
@Controller('admin/certifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminCertificationsController {
  constructor(private readonly certs: CertificationsService) {}

  @Get()
  list(@Query() query: AdminCertificationListQueryDto) {
    return this.certs.adminList(query);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveCertificationDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.certs.adminApprove(id, actor.id, dto.expires_at);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectCertificationDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.certs.adminReject(id, actor.id, dto.reason);
  }
}
