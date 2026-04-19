import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  Certification,
  CertificationStatus,
  CertificationType,
  OcrExtractionResult,
} from '../../entities/certification.entity';
import { User } from '../../entities/user.entity';
import { Vehicle } from '../../entities/vehicle.entity';
import { AdminAuditService } from '../admin/services/admin-audit.service';
import { RealtimeBus } from '../realtime-bus/realtime-bus.service';
import { UploadsService } from '../uploads/uploads.service';
import type { AdminCertificationListQueryDto } from './dto/admin-list-query.dto';
import { nameSimilarity, plateMatches } from './name-match';
import {
  OCR_PROVIDER,
  type OcrProvider,
  type OcrVehicleExtraction,
} from './ocr/ocr-provider.interface';

const REMINDER_WINDOW_DAYS = 14;

export interface CertificationDto {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  type: CertificationType;
  status: CertificationStatus;
  file_url: string;
  ocr_extracted: OcrExtractionResult | null;
  rejection_reason: string | null;
  expires_at: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface VehicleCertification {
  vehicle_id: string;
  plate: string;
  model: string;
  color: string;
  is_certified: boolean;
  certified_until: string | null;
  expires_in_days: number | null;
  needs_renewal_reminder: boolean;
  latest: CertificationDto | null;
}

export interface MyCertifications {
  license: CertificationDto | null;
  vehicles: VehicleCertification[];
}

@Injectable()
export class CertificationsService {
  private readonly logger = new Logger(CertificationsService.name);

  constructor(
    @InjectRepository(Certification)
    private readonly certifications: Repository<Certification>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @Inject(OCR_PROVIDER) private readonly ocr: OcrProvider,
    private readonly uploads: UploadsService,
    private readonly realtimeBus: RealtimeBus,
    private readonly audit: AdminAuditService,
    private readonly config: ConfigService,
  ) {}

  private nameThreshold(): number {
    const raw = this.config.get<string | number>(
      'OCR_NAME_SIMILARITY_THRESHOLD',
    );
    const v = raw == null ? 0.85 : Number(raw);
    return Number.isFinite(v) && v > 0 ? v : 0.85;
  }

  private confidenceThreshold(): number {
    const raw = this.config.get<string | number>('OCR_MIN_CONFIDENCE');
    const v = raw == null ? 0.8 : Number(raw);
    return Number.isFinite(v) && v > 0 ? v : 0.8;
  }

  private static toFileUrl(path: string): string {
    return `/api/uploads/${path}`;
  }

  private static daysUntil(date: string | null): number | null {
    if (!date) return null;
    const target = new Date(date);
    if (Number.isNaN(target.getTime())) return null;
    const now = new Date();
    target.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diff = target.getTime() - now.getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
  }

  private static isFutureDate(iso: string | null): boolean {
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() >= today.getTime();
  }

  private toDto(c: Certification): CertificationDto {
    return {
      id: c.id,
      user_id: c.user_id,
      vehicle_id: c.vehicle_id,
      type: c.type,
      status: c.status,
      file_url: CertificationsService.toFileUrl(c.file_path),
      ocr_extracted: c.ocr_extracted,
      rejection_reason: c.rejection_reason,
      expires_at: c.expires_at,
      created_at: c.created_at.toISOString(),
      reviewed_at: c.reviewed_at ? c.reviewed_at.toISOString() : null,
    };
  }

  /**
   * Replaces the user's previous license submission. Each driver only
   * keeps the latest row visible to the UI; superseded rows are
   * deleted (their files stay on disk for traceability — could be
   * GC'ed by a future job).
   */
  async submitLicense(
    userId: string,
    file: Express.Multer.File | undefined,
  ): Promise<CertificationDto> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const stored = await this.uploads.store('licenses', file);
    const cert = this.certifications.create({
      user_id: userId,
      vehicle_id: null,
      type: CertificationType.LICENSE,
      file_path: stored.relativePath,
      status: CertificationStatus.PENDING_OCR,
    });
    const saved = await this.certifications.save(cert);

    let extraction;
    try {
      extraction = await this.ocr.extractLicense(stored.buffer, stored.mime);
    } catch (err) {
      this.logger.error(`OCR failure on license: ${(err as Error).message}`);
      extraction = {
        confidence: 0,
        decision_notes: `Erreur OCR: ${(err as Error).message}`,
        raw: null,
      };
    }

    const referenceName = [user.first_name, user.last_name]
      .filter((s): s is string => !!s && s.trim().length > 0)
      .join(' ');
    const similarity = nameSimilarity(extraction.name, referenceName);
    const expiry = extraction.expires_at ?? null;
    const conf = extraction.confidence ?? 0;

    let nextStatus: CertificationStatus = CertificationStatus.PENDING_REVIEW;
    let notes = extraction.decision_notes ?? null;

    if (
      similarity >= this.nameThreshold() &&
      conf >= this.confidenceThreshold() &&
      CertificationsService.isFutureDate(expiry)
    ) {
      nextStatus = CertificationStatus.APPROVED;
      notes =
        notes ||
        `Auto-approuvé (similarité nom ${similarity.toFixed(2)}, confiance ${conf.toFixed(2)})`;
    } else {
      const reasons: string[] = [];
      if (similarity < this.nameThreshold())
        reasons.push(`nom (${similarity.toFixed(2)})`);
      if (conf < this.confidenceThreshold())
        reasons.push(`confiance (${conf.toFixed(2)})`);
      if (!CertificationsService.isFutureDate(expiry))
        reasons.push('date manquante ou passée');
      notes =
        notes ||
        `Revue manuelle requise: ${reasons.join(', ') || 'critères non remplis'}`;
    }

    saved.ocr_extracted = {
      ...extraction,
      decision_notes: notes,
    };
    saved.status = nextStatus;
    saved.expires_at = expiry;
    if (nextStatus === CertificationStatus.APPROVED) {
      saved.reviewed_at = new Date();
    }
    await this.certifications.save(saved);

    return this.toDto(saved);
  }

  /**
   * Sends a 3/4-face vehicle photo to the OCR backend so the driver
   * onboarding wizard can pre-fill the vehicle creation form. Stateless:
   * no DB write, no upload — the photo is only persisted later by
   * `VehiclesService.createMine` when the user confirms the form.
   */
  async analyzeVehiclePhoto(
    file: Express.Multer.File | undefined,
  ): Promise<OcrVehicleExtraction> {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Fichier vide');
    }
    try {
      return await this.ocr.extractVehicle(file.buffer, file.mimetype);
    } catch (err) {
      this.logger.error(
        `OCR failure on vehicle photo: ${(err as Error).message}`,
      );
      return {
        make: null,
        model: null,
        color: null,
        plate: null,
        confidence: 0,
        decision_notes: `Erreur OCR: ${(err as Error).message}`,
        raw: null,
      };
    }
  }

  async submitInsurance(
    userId: string,
    vehicleId: string,
    file: Express.Multer.File | undefined,
  ): Promise<CertificationDto> {
    const vehicle = await this.vehicles.findOne({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Véhicule introuvable');
    if (vehicle.user_id !== userId) {
      throw new ForbiddenException();
    }

    const stored = await this.uploads.store('insurance', file);
    const cert = this.certifications.create({
      user_id: userId,
      vehicle_id: vehicleId,
      type: CertificationType.INSURANCE,
      file_path: stored.relativePath,
      status: CertificationStatus.PENDING_OCR,
    });
    const saved = await this.certifications.save(cert);

    let extraction;
    try {
      extraction = await this.ocr.extractInsurance(stored.buffer, stored.mime);
    } catch (err) {
      this.logger.error(`OCR failure on insurance: ${(err as Error).message}`);
      extraction = {
        confidence: 0,
        decision_notes: `Erreur OCR: ${(err as Error).message}`,
        raw: null,
      };
    }

    const matches = plateMatches(extraction.plate, vehicle.plate);
    const expiry = extraction.expires_at ?? null;
    const conf = extraction.confidence ?? 0;

    let nextStatus: CertificationStatus = CertificationStatus.PENDING_REVIEW;
    let notes = extraction.decision_notes ?? null;

    if (
      matches &&
      conf >= this.confidenceThreshold() &&
      CertificationsService.isFutureDate(expiry)
    ) {
      nextStatus = CertificationStatus.APPROVED;
      notes =
        notes || `Auto-approuvé (plaque OK, confiance ${conf.toFixed(2)})`;
    } else {
      const reasons: string[] = [];
      if (!matches) reasons.push('plaque ne correspond pas');
      if (conf < this.confidenceThreshold())
        reasons.push(`confiance (${conf.toFixed(2)})`);
      if (!CertificationsService.isFutureDate(expiry))
        reasons.push('date manquante ou passée');
      notes =
        notes ||
        `Revue manuelle requise: ${reasons.join(', ') || 'critères non remplis'}`;
    }

    saved.ocr_extracted = {
      ...extraction,
      decision_notes: notes,
    };
    saved.status = nextStatus;
    saved.expires_at = expiry;
    if (nextStatus === CertificationStatus.APPROVED) {
      saved.reviewed_at = new Date();
      await this.applyInsuranceApproval(vehicle, expiry);
    }
    await this.certifications.save(saved);

    return this.toDto(saved);
  }

  /**
   * Updates the denormalised `vehicles.is_certified` / `certified_until`
   * cache. Called both at auto-approve time and from `adminApprove`.
   */
  private async applyInsuranceApproval(
    vehicle: Vehicle,
    expiresAt: string | null,
  ): Promise<void> {
    vehicle.is_certified = !!expiresAt;
    vehicle.certified_until = expiresAt;
    await this.vehicles.save(vehicle);
  }

  /**
   * Loads what the driver should see on `/profile`:
   *   - latest license submission (active or pending)
   *   - per-vehicle insurance status with reminder flags
   */
  async getMine(userId: string): Promise<MyCertifications> {
    const license = await this.certifications.findOne({
      where: { user_id: userId, type: CertificationType.LICENSE },
      order: { created_at: 'DESC' },
    });

    const vehicles = await this.vehicles.find({
      where: { user_id: userId },
      order: { created_at: 'ASC' },
    });

    const vehicleIds = vehicles.map((v) => v.id);
    const insuranceRows = vehicleIds.length
      ? await this.certifications.find({
          where: {
            type: CertificationType.INSURANCE,
            vehicle_id: In(vehicleIds),
          },
          order: { created_at: 'DESC' },
        })
      : [];
    const latestByVehicle = new Map<string, Certification>();
    for (const row of insuranceRows) {
      if (row.vehicle_id && !latestByVehicle.has(row.vehicle_id)) {
        latestByVehicle.set(row.vehicle_id, row);
      }
    }

    const vehicleStatus: VehicleCertification[] = vehicles.map((v) => {
      const latest = latestByVehicle.get(v.id) ?? null;
      const days = CertificationsService.daysUntil(v.certified_until);
      const needsReminder =
        v.is_certified &&
        days !== null &&
        days <= REMINDER_WINDOW_DAYS &&
        days >= 0 &&
        // Don't badger the driver if a fresh submission is pending
        // review or already approved with a later date.
        !(
          latest &&
          [
            CertificationStatus.PENDING_OCR,
            CertificationStatus.PENDING_REVIEW,
          ].includes(latest.status)
        );
      return {
        vehicle_id: v.id,
        plate: v.plate,
        model: v.model,
        color: v.color,
        is_certified: v.is_certified,
        certified_until: v.certified_until,
        expires_in_days: days,
        needs_renewal_reminder: needsReminder,
        latest: latest ? this.toDto(latest) : null,
      };
    });

    return {
      license: license ? this.toDto(license) : null,
      vehicles: vehicleStatus,
    };
  }

  async adminList(query: AdminCertificationListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const qb = this.certifications
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'u')
      .leftJoinAndSelect('c.vehicle', 'v')
      .orderBy('c.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }
    if (query.type) {
      qb.andWhere('c.type = :type', { type: query.type });
    }
    const [rows, total] = await qb.getManyAndCount();
    return {
      total,
      page,
      pageSize,
      items: rows.map((c) => ({
        ...this.toDto(c),
        user: {
          id: c.user.id,
          email: c.user.email,
          full_name: c.user.full_name,
          first_name: c.user.first_name,
          last_name: c.user.last_name,
        },
        vehicle: c.vehicle
          ? {
              id: c.vehicle.id,
              plate: c.vehicle.plate,
              model: c.vehicle.model,
              color: c.vehicle.color,
            }
          : null,
      })),
    };
  }

  async adminApprove(
    id: string,
    actorId: string,
    expiresAt?: string,
  ): Promise<CertificationDto> {
    const cert = await this.certifications.findOne({
      where: { id },
      relations: { vehicle: true },
    });
    if (!cert) throw new NotFoundException('Certification introuvable');
    if (cert.status === CertificationStatus.APPROVED) {
      // Idempotent — return current state.
      return this.toDto(cert);
    }

    const finalExpiry = expiresAt ?? cert.expires_at;
    if (!CertificationsService.isFutureDate(finalExpiry)) {
      throw new BadRequestException(
        'La date de validité doit être renseignée et future',
      );
    }

    cert.status = CertificationStatus.APPROVED;
    cert.expires_at = finalExpiry;
    cert.reviewed_at = new Date();
    cert.reviewed_by_user_id = actorId;
    cert.rejection_reason = null;
    await this.certifications.save(cert);

    if (cert.type === CertificationType.INSURANCE && cert.vehicle) {
      await this.applyInsuranceApproval(cert.vehicle, finalExpiry);
    }

    await this.audit.record({
      actorId,
      action: 'certification.approve',
      targetType: 'certification',
      targetId: cert.id,
      payload: {
        type: cert.type,
        user_id: cert.user_id,
        vehicle_id: cert.vehicle_id,
        expires_at: finalExpiry,
      },
    });

    this.realtimeBus.emitToUser(cert.user_id, 'certification:updated', {
      id: cert.id,
      type: cert.type,
      status: cert.status,
      vehicle_id: cert.vehicle_id,
      expires_at: cert.expires_at,
    });

    return this.toDto(cert);
  }

  async adminReject(
    id: string,
    actorId: string,
    reason: string,
  ): Promise<CertificationDto> {
    const cert = await this.certifications.findOne({
      where: { id },
      relations: { vehicle: true },
    });
    if (!cert) throw new NotFoundException('Certification introuvable');

    cert.status = CertificationStatus.REJECTED;
    cert.rejection_reason = reason.trim().slice(0, 500);
    cert.reviewed_at = new Date();
    cert.reviewed_by_user_id = actorId;
    await this.certifications.save(cert);

    if (cert.type === CertificationType.INSURANCE && cert.vehicle) {
      // If a previously-approved row gets rejected, the vehicle loses
      // its certification immediately.
      cert.vehicle.is_certified = false;
      cert.vehicle.certified_until = null;
      await this.vehicles.save(cert.vehicle);
    }

    await this.audit.record({
      actorId,
      action: 'certification.reject',
      targetType: 'certification',
      targetId: cert.id,
      payload: {
        type: cert.type,
        user_id: cert.user_id,
        vehicle_id: cert.vehicle_id,
        reason: cert.rejection_reason,
      },
    });

    this.realtimeBus.emitToUser(cert.user_id, 'certification:updated', {
      id: cert.id,
      type: cert.type,
      status: cert.status,
      vehicle_id: cert.vehicle_id,
      rejection_reason: cert.rejection_reason,
    });

    return this.toDto(cert);
  }

  /**
   * Daily sweep: flips approved-but-past-due certifications to `expired`
   * and decertifies the matching vehicles. Called by the scheduler.
   */
  async expireOverdue(): Promise<{ certifications: number; vehicles: number }> {
    const todayIso = new Date().toISOString().slice(0, 10);
    const overdueCerts = await this.certifications.find({
      where: { status: CertificationStatus.APPROVED },
    });
    let certCount = 0;
    const expiredVehicleIds = new Set<string>();
    for (const cert of overdueCerts) {
      if (cert.expires_at && cert.expires_at < todayIso) {
        cert.status = CertificationStatus.EXPIRED;
        await this.certifications.save(cert);
        certCount++;
        if (cert.type === CertificationType.INSURANCE && cert.vehicle_id) {
          expiredVehicleIds.add(cert.vehicle_id);
        }
      }
    }
    let vehicleCount = 0;
    if (expiredVehicleIds.size > 0) {
      const result = await this.vehicles
        .createQueryBuilder()
        .update()
        .set({ is_certified: false, certified_until: null })
        .where('id IN (:...ids)', { ids: [...expiredVehicleIds] })
        .execute();
      vehicleCount = result.affected ?? expiredVehicleIds.size;
    }
    return { certifications: certCount, vehicles: vehicleCount };
  }

  /**
   * Pushes a WebSocket reminder to drivers whose vignette expires within
   * the next `REMINDER_WINDOW_DAYS` days. Idempotent — the frontend
   * dedupes on its side using a localStorage TTL so receiving multiple
   * pushes doesn't spam the user.
   */
  async pushExpiringReminders(): Promise<{ notified: number }> {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + REMINDER_WINDOW_DAYS);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    const todayIso = now.toISOString().slice(0, 10);

    const expiring = await this.vehicles
      .createQueryBuilder('v')
      .where('v.is_certified = TRUE')
      .andWhere('v.certified_until IS NOT NULL')
      .andWhere('v.certified_until <= :cutoff', { cutoff: cutoffIso })
      .andWhere('v.certified_until >= :today', { today: todayIso })
      .getMany();

    for (const v of expiring) {
      const days = CertificationsService.daysUntil(v.certified_until);
      this.realtimeBus.emitToUser(v.user_id, 'certification:expiring', {
        vehicle_id: v.id,
        plate: v.plate,
        certified_until: v.certified_until,
        days_left: days,
      });
    }
    return { notified: expiring.length };
  }
}
