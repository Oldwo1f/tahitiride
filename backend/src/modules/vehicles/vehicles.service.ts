import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { Vehicle } from '../../entities/vehicle.entity';
import type { CreateVehicleDto } from './dto/create-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicles: Repository<Vehicle>,
  ) {}

  listMine(userId: string) {
    return this.vehicles.find({
      where: { user_id: userId },
      order: { created_at: 'ASC' },
    });
  }

  async createMine(userId: string, dto: CreateVehicleDto) {
    const v = this.vehicles.create({
      user_id: userId,
      plate: dto.plate.toUpperCase(),
      model: dto.model,
      color: dto.color,
      qr_secret: randomBytes(32).toString('hex'),
    });
    return this.vehicles.save(v);
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
