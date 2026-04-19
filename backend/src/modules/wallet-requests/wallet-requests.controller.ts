import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { WalletRequestsService } from './wallet-requests.service';

@Controller('wallet-requests')
@UseGuards(JwtAuthGuard)
export class WalletRequestsController {
  constructor(private readonly service: WalletRequestsService) {}

  @Get('mine')
  listMine(@CurrentUser() user: AuthUser) {
    return this.service.listMine(user.id);
  }

  @Get('last-iban')
  getLastIban(@CurrentUser() user: AuthUser) {
    return this.service.getLastIban(user.id);
  }

  @Post('deposit')
  @HttpCode(201)
  createDeposit(@CurrentUser() user: AuthUser, @Body() dto: CreateDepositDto) {
    return this.service.createDeposit(user.id, dto);
  }

  @Post('payout')
  @HttpCode(201)
  createPayout(@CurrentUser() user: AuthUser, @Body() dto: CreatePayoutDto) {
    return this.service.createPayout(user.id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.cancelMine(user.id, id);
  }
}
