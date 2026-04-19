import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { existsSync, statSync } from 'fs';
import { extname, join, normalize, relative } from 'path';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/types/direction.enum';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  categoryDir,
  PUBLIC_UPLOAD_CATEGORIES,
  resolveUploadRoot,
  UploadCategory,
  UPLOAD_CATEGORIES,
} from './upload-paths';
import { UploadsAccessService } from './uploads-access.service';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Serves uploaded files (avatars, license photos, insurance vignettes)
 * behind JWT auth + ownership checks. Avatars are accessible to any
 * authenticated user (so peers can see avatars on the map / trip
 * screens); license + insurance photos are restricted to the owning
 * driver and admins.
 */
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly access: UploadsAccessService) {}

  @Get(':category/:filename')
  async serve(
    @Param('category') category: string,
    @Param('filename') filename: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    if (!UPLOAD_CATEGORIES.includes(category as UploadCategory)) {
      throw new NotFoundException('Catégorie inconnue');
    }
    const cat = category as UploadCategory;

    // Block traversal: resolve the candidate path then ensure it stays
    // under the category root.
    const root = resolveUploadRoot();
    const candidate = normalize(join(categoryDir(cat), filename));
    const rel = relative(categoryDir(cat), candidate);
    if (rel.startsWith('..') || rel.includes('/')) {
      throw new BadRequestException('Nom de fichier invalide');
    }

    if (!existsSync(candidate) || !statSync(candidate).isFile()) {
      throw new NotFoundException('Fichier introuvable');
    }

    if (!PUBLIC_UPLOAD_CATEGORIES.has(cat)) {
      const isAdmin = (user.role as UserRole) === UserRole.ADMIN;
      const owns = await this.access.canAccess(user.id, cat, filename);
      if (!owns && !isAdmin) {
        throw new ForbiddenException();
      }
    }

    const ext = extname(filename).toLowerCase();
    const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.sendFile(candidate, { root: undefined });
    void root;
  }
}
