import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Certification } from '../../entities/certification.entity';
import { User } from '../../entities/user.entity';
import { Vehicle } from '../../entities/vehicle.entity';
import { AdminModule } from '../admin/admin.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AdminCertificationsController } from './admin-certifications.controller';
import { CertificationsController } from './certifications.controller';
import { CertificationsScheduler } from './certifications.scheduler';
import { CertificationsService } from './certifications.service';
import { OCR_PROVIDER } from './ocr/ocr-provider.interface';
import { OpenAiVisionOcrProvider } from './ocr/openai-vision.provider';
import { StubOcrProvider } from './ocr/stub.provider';

/**
 * Picks the active OCR backend at boot time:
 *   - `OPENAI_API_KEY` set → OpenAI vision provider
 *   - otherwise → safe stub that defers everything to admin review
 *
 * To plug another provider (Mindee, in-house model), instantiate it here.
 */
const ocrProvider: Provider = {
  provide: OCR_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const key = config.get<string>('OPENAI_API_KEY');
    if (key && key.trim().length > 0) {
      return new OpenAiVisionOcrProvider(config);
    }
    return new StubOcrProvider();
  },
};

@Module({
  imports: [
    TypeOrmModule.forFeature([Certification, User, Vehicle]),
    UploadsModule,
    AdminModule,
  ],
  controllers: [CertificationsController, AdminCertificationsController],
  providers: [
    CertificationsService,
    CertificationsScheduler,
    StubOcrProvider,
    ocrProvider,
  ],
  exports: [CertificationsService],
})
export class CertificationsModule {}
