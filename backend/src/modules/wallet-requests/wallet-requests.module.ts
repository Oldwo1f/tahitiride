import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { WalletRequest } from '../../entities/wallet-request.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WalletRequestsController } from './wallet-requests.controller';
import { WalletRequestsService } from './wallet-requests.service';

@Module({
  imports: [TypeOrmModule.forFeature([WalletRequest, Wallet, User])],
  controllers: [WalletRequestsController],
  providers: [WalletRequestsService],
  exports: [WalletRequestsService],
})
export class WalletRequestsModule {}
