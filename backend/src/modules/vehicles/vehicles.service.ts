import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Vehicle } from '../../entities/vehicle.entity';
import { UploadsService } from '../uploads/uploads.service';
import type { CreateVehicleDto } from './dto/create-vehicle.dto';

export interface VehicleListItem {
  id: string;
  user_id: string;
  plate: string;
  model: string;
  color: string;
  is_certified: boolean;
  certified_until: string | null;
  photo_path: string | null;
  /** Auth-protected URL to render the photo (`/api/uploads/<photo_path>`). */
  photo_url: string | null;
  created_at: Date;
}

export interface CreateVehicleResult {
  vehicle: VehicleListItem;
  /**
   * True when this creation flipped the owner's `is_driver` flag from
   * false to true (first vehicle for a passenger account). Lets the
   * frontend refresh its auth store / unlock the driver-only UI.
   */
  user_promoted: boolean;
  /** Resulting driver-mode flag after the (possibly no-op) promotion. */
  user_is_driver: boolean;
}

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly uploads: UploadsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Builds the public URL the frontend should fetch to display a
   * vehicle photo. Returns null when no photo is set so the UI can
   * fall back to a default car icon.
   */
  static buildPhotoUrl(photoPath: string | null): string | null {
    if (!photoPath) return null;
    return `/api/uploads/${photoPath}`;
  }

  private static toListItem(v: Vehicle): VehicleListItem {
    return {
      id: v.id,
      user_id: v.user_id,
      plate: v.plate,
      model: v.model,
      color: v.color,
      is_certified: v.is_certified,
      certified_until: v.certified_until,
      photo_path: v.photo_path,
      photo_url: VehiclesService.buildPhotoUrl(v.photo_path),
      created_at: v.created_at,
    };
  }

  async listMine(userId: string): Promise<VehicleListItem[]> {
    const rows = await this.vehicles.find({
      where: { user_id: userId },
      order: { created_at: 'ASC' },
    });
    return rows.map((v) => VehiclesService.toListItem(v));
  }

  /**
   * Persists a new vehicle for the user, optionally with a 3/4 face
   * photo captured by the driver onboarding wizard. When the owner
   * is still in passenger-only mode (typical first run of the
   * wizard) we flip `is_driver` to true in the same transaction so
   * the driver-only UI unlocks immediately on the next request.
   */
  async createMine(
    userId: string,
    dto: CreateVehicleDto,
    photo?: Express.Multer.File,
  ): Promise<CreateVehicleResult> {
    let photoPath: string | null = null;
    if (photo) {
      const stored = await this.uploads.store('vehicles', photo);
      photoPath = stored.relativePath;
    }

    return this.dataSource.transaction(async (tx) => {
      const vehicleRepo = tx.getRepository(Vehicle);
      const userRepo = tx.getRepository(User);

      const created = await vehicleRepo.save(
        vehicleRepo.create({
          user_id: userId,
          plate: dto.plate.toUpperCase(),
          model: dto.model,
          color: dto.color,
          qr_secret: randomBytes(32).toString('hex'),
          photo_path: photoPath,
        }),
      );

      const user = await userRepo.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');

      let userPromoted = false;
      if (!user.is_driver) {
        user.is_driver = true;
        await userRepo.save(user);
        userPromoted = true;
      }

      return {
        vehicle: VehiclesService.toListItem(created),
        user_promoted: userPromoted,
        user_is_driver: !!user.is_driver,
      };
    });
  }

  async deleteMine(userId: string, vehicleId: string) {
    const v = await this.vehicles.findOne({ where: { id: vehicleId } });
    if (!v) throw new NotFoundException('Vehicle not found');
    if (v.user_id !== userId) throw new ForbiddenException();
    await this.vehicles.remove(v);
    return { ok: true };
  }

  async getById(vehicleId: string) {
    return this.vehicles.findOne({ where: { id: vehicleId } });
  }

  async getFirstForUser(userId: string) {
    return this.vehicles.findOne({
      where: { user_id: userId },
      order: { created_at: 'ASC' },
    });
  }

  async getForUserStrict(userId: string) {
    const v = await this.getFirstForUser(userId);
    if (!v) throw new NotFoundException('No vehicle registered');
    return v;
  }
}
