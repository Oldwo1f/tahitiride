import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Vehicle } from '../../entities/vehicle.entity';
import { UploadsService } from '../uploads/uploads.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';

export interface ProfileResponse {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
  avatar_url: string | null;
  role: User['role'];
  is_driver: boolean;
  created_at: Date;
  suspended_at: Date | null;
  vehicles?: User['vehicles'];
  wallet?: User['wallet'];
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    private readonly uploads: UploadsService,
  ) {}

  /**
   * Builds the public URL the frontend should fetch to display the avatar.
   * Returns null when no avatar is set so the UI can fall back to the
   * deterministic LetterAvatar.
   */
  static buildAvatarUrl(avatarPath: string | null): string | null {
    if (!avatarPath) return null;
    return `/api/uploads/${avatarPath}`;
  }

  private toResponse(user: User): ProfileResponse {
    const { password_hash: _omit, ...rest } = user;
    void _omit;
    return {
      ...rest,
      is_driver: !!user.is_driver,
      avatar_url: UsersService.buildAvatarUrl(user.avatar_path),
    };
  }

  async getProfile(userId: string): Promise<ProfileResponse> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { vehicles: true, wallet: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toResponse(user);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileResponse> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (
      dto.first_name === undefined &&
      dto.last_name === undefined &&
      dto.phone === undefined
    ) {
      throw new BadRequestException('Aucune modification fournie');
    }

    if (dto.first_name !== undefined) user.first_name = dto.first_name.trim();
    if (dto.last_name !== undefined) user.last_name = dto.last_name.trim();
    if (dto.phone !== undefined) {
      user.phone = dto.phone.trim() || null;
    }

    if (dto.first_name !== undefined || dto.last_name !== undefined) {
      const composed = [user.first_name, user.last_name]
        .filter((s) => !!s && s.trim().length > 0)
        .join(' ')
        .trim();
      if (!composed) {
        throw new BadRequestException(
          'Le prénom ou le nom doit être renseigné',
        );
      }
      user.full_name = composed.slice(0, 120);
    }

    await this.users.save(user);
    return this.getProfile(userId);
  }

  async setAvatar(
    userId: string,
    file: Express.Multer.File | undefined,
  ): Promise<ProfileResponse> {
    const stored = await this.uploads.store('avatars', file);
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.avatar_path = stored.relativePath;
    await this.users.save(user);
    return this.getProfile(userId);
  }

  /**
   * Self-service driver-mode toggle. Turning the flag on requires at
   * least one registered vehicle — the frontend delegates that first
   * bootstrap to the onboarding wizard, which creates a vehicle (and
   * flips the flag as a side effect in `VehiclesService.createMine`).
   * Calling this endpoint directly without a vehicle keeps the user in
   * a consistent state and surfaces a clear error message.
   */
  async setDriverMode(
    userId: string,
    isDriver: boolean,
  ): Promise<ProfileResponse> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.deleted_at) throw new NotFoundException('User not found');

    if (isDriver && !user.is_driver) {
      const vehicleCount = await this.vehicles.count({
        where: { user_id: userId },
      });
      if (vehicleCount === 0) {
        throw new BadRequestException(
          "Ajoutez un véhicule avant d'activer le mode conducteur",
        );
      }
    }

    if (user.is_driver !== isDriver) {
      user.is_driver = isDriver;
      await this.users.save(user);
    }
    return this.getProfile(userId);
  }
}
