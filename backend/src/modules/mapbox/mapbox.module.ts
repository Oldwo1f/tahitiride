import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MapboxService } from './mapbox.service';

@Module({
  imports: [HttpModule],
  providers: [MapboxService],
  exports: [MapboxService],
})
export class MapboxModule {}
