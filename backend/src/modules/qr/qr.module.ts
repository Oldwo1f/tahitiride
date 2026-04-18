import { Module } from '@nestjs/common';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';

@Module({
  imports: [VehiclesModule],
  controllers: [QrController],
  providers: [QrService],
  exports: [QrService],
})
export class QrModule {}
