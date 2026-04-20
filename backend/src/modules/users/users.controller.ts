import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateModeDto } from './dto/update-mode.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.getProfile(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  /**
   * Self-service driver-mode toggle. Exposes `is_driver` as a
   * capability any authenticated user (admin included) can flip from
   * their profile. Turning the flag on requires at least one vehicle
   * — the onboarding wizard takes care of that.
   */
  @Patch('me/mode')
  updateMode(@CurrentUser() user: AuthUser, @Body() dto: UpdateModeDto) {
    return this.users.setDriverMode(user.id, dto.is_driver);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  setAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.users.setAvatar(user.id, file);
  }
}
