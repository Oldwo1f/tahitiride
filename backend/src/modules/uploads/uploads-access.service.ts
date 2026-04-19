import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certification } from '../../entities/certification.entity';
import {
  PUBLIC_UPLOAD_CATEGORIES,
  relativeUploadPath,
  UploadCategory,
} from './upload-paths';

/**
 * Resolves whether a given user is allowed to download a file in
 * the protected upload categories. Public categories (see
 * `PUBLIC_UPLOAD_CATEGORIES` — avatars + vehicle photos) are handled
 * by the controller and skip this check entirely.
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
    if (PUBLIC_UPLOAD_CATEGORIES.has(category)) return true;
    const path = relativeUploadPath(category, filename);
    const row = await this.certifications.findOne({
      where: { file_path: path, user_id: userId },
      select: { id: true },
    });
    return !!row;
  }
}
