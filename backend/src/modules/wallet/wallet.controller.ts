import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  getMine(@CurrentUser() user: AuthUser) {
    return this.wallet.getMine(user.id);
  }

  @Get('transactions')
  listMine(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.wallet.listTransactions(
      user.id,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
