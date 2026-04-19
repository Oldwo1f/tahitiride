import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LineString } from 'geojson';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TripStatus } from '../../../common/types/direction.enum';
import { Trip } from '../../../entities/trip.entity';
import { AdminAuditService } from './admin-audit.service';

export interface AdminTripsListQuery {
  status?: TripStatus;
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AdminTripsService {
  constructor(
    @InjectRepository(Trip) private readonly trips: Repository<Trip>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly audit: AdminAuditService,
  ) {}

  async list(query: AdminTripsListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const qb = this.trips
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.passenger', 'p')
      .leftJoinAndSelect('t.driver', 'd')
      .leftJoinAndSelect('t.vehicle', 'v')
      .orderBy('t.started_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    if (query.status) {
      qb.andWhere('t.status = :status', { status: query.status });
    }
    if (query.userId) {
      qb.andWhere('(t.passenger_id = :uid OR t.driver_id = :uid)', {
        uid: query.userId,
      });
    }
    if (query.from) {
      qb.andWhere('t.started_at >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('t.started_at <= :to', { to: query.to });
    }
    const [rows, total] = await qb.getManyAndCount();
    return {
      total,
      page,
      pageSize,
      items: rows.map((t) => ({
        id: t.id,
        status: t.status,
        started_at: t.started_at,
        ended_at: t.ended_at,
        distance_m: t.distance_m,
        fare_xpf: t.fare_xpf,
        driver_share_xpf: t.driver_share_xpf,
        passenger_id: t.passenger_id,
        passenger_email: t.passenger?.email ?? null,
        passenger_name: t.passenger?.full_name ?? null,
        driver_id: t.driver_id,
        driver_email: t.driver?.email ?? null,
        driver_name: t.driver?.full_name ?? null,
        vehicle_plate: t.vehicle?.plate ?? null,
        vehicle_model: t.vehicle?.model ?? null,
        vehicle_color: t.vehicle?.color ?? null,
      })),
    };
  }

  async getOne(id: string) {
    const trip = await this.trips.findOne({
      where: { id },
      relations: { passenger: true, driver: true, vehicle: true },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    const pointsCountRow = await this.ds.query<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count FROM trip_points WHERE trip_id = $1`,
      [id],
    );
    const platformMargin =
      trip.fare_xpf != null && trip.driver_share_xpf != null
        ? trip.fare_xpf - trip.driver_share_xpf
        : null;
    return {
      id: trip.id,
      status: trip.status,
      started_at: trip.started_at,
      ended_at: trip.ended_at,
      distance_m: trip.distance_m,
      fare_xpf: trip.fare_xpf,
      driver_share_xpf: trip.driver_share_xpf,
      platform_margin_xpf: platformMargin,
      points_count: Number(pointsCountRow[0]?.count ?? 0),
      passenger: trip.passenger
        ? {
            id: trip.passenger.id,
            email: trip.passenger.email,
            full_name: trip.passenger.full_name,
          }
        : null,
      driver: trip.driver
        ? {
            id: trip.driver.id,
            email: trip.driver.email,
            full_name: trip.driver.full_name,
          }
        : null,
      vehicle: trip.vehicle
        ? {
            id: trip.vehicle.id,
            plate: trip.vehicle.plate,
            model: trip.vehicle.model,
            color: trip.vehicle.color,
          }
        : null,
    };
  }

  /**
   * Returns a GeoJSON LineString built from the recorded trip points
   * (chronological order). Returns `null` if fewer than 2 points exist.
   */
  async getPointsAsLineString(id: string): Promise<LineString | null> {
    const trip = await this.trips.findOne({ where: { id } });
    if (!trip) throw new NotFoundException('Trip not found');
    const rows = await this.ds.query<
      {
        seq: number;
        recorded_at: Date;
        lng: string;
        lat: string;
      }[]
    >(
      `SELECT seq, recorded_at,
              ST_X(position::geometry)::text AS lng,
              ST_Y(position::geometry)::text AS lat
       FROM trip_points
       WHERE trip_id = $1
       ORDER BY seq ASC`,
      [id],
    );
    if (rows.length < 2) return null;
    return {
      type: 'LineString',
      coordinates: rows.map((r) => [Number(r.lng), Number(r.lat)]),
    };
  }

  async cancel(id: string, reason: string, actorId: string) {
    const trip = await this.trips.findOne({ where: { id } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.status !== TripStatus.ACTIVE) {
      throw new BadRequestException('Only active trips can be cancelled');
    }
    trip.status = TripStatus.CANCELLED;
    trip.ended_at = new Date();
    await this.trips.save(trip);
    await this.audit.record({
      actorId,
      action: 'trip.cancel',
      targetType: 'trip',
      targetId: id,
      payload: { reason },
    });
    return { ok: true, id, status: trip.status };
  }
}
