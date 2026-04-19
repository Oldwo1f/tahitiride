import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { memoryStorage } from 'multer';
import { Certification } from '../../entities/certification.entity';
import { UploadsAccessService } from './uploads-access.service';
import { UploadsController } from './uploads.controller';
import { UploadsService, MAX_UPLOAD_BYTES } from './uploads.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Certification]),
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    }),
  ],
  controllers: [UploadsController],
  providers: [UploadsService, UploadsAccessService],
  exports: [UploadsService, MulterModule],
})
export class UploadsModule {}
