import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certification } from '../../entities/certification.entity';
import { relativeUploadPath, UploadCategory } from './upload-paths';

/**
 * Resolves whether a given user is allowed to download a file in
 * the protected upload categories. Avatars are public to any
 * authenticated user (handled by the controller) so this only
 * needs to check certification files.
 */
@Injectable()
export class UploadsAccessService {
  constructor(
    @InjectRepository(Certification)
    private readonly certifications: Repository<Certification>,
  ) {}

  async canAccess(
    userId: string,
    category: UploadCategory,
    filename: string,
  ): Promise<boolean> {
    if (category === 'avatars') return true;
    const path = relativeUploadPath(category, filename);
    const row = await this.certifications.findOne({
      where: { file_path: path, user_id: userId },
      select: { id: true },
    });
    return !!row;
  }
}
