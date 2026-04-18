import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Direction } from '../../common/types/direction.enum';

export interface NearbyDriver {
  user_id: string;
  full_name: string;
  vehicle_id: string | null;
  plate: string | null;
  direction: Direction;
  lng: number;
  lat: number;
  heading: number | null;
  speed: number | null;
  distance_m: number;
}

export interface NearbyPassenger {
  user_id: string;
  full_name: string;
  direction: Direction;
  lng: number;
  lat: number;
  distance_m: number;
}

export interface PositionDto {
  lng: number;
  lat: number;
}

@Injectable()
export class LocationsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async driverOnline(params: {
    userId: string;
    vehicleId: string;
    direction: Direction;
    position: PositionDto;
    heading: number | null;
    speed: number | null;
  }): Promise<void> {
    const { userId, vehicleId, direction, position, heading, speed } = params;
    await this.ds.query(
      `INSERT INTO driver_status
         (user_id, vehicle_id, is_online, direction, current_position, heading, speed, last_seen_at)
       VALUES ($1, $2, true, $3::direction_enum,
         ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         vehicle_id = EXCLUDED.vehicle_id,
         is_online = true,
         direction = EXCLUDED.direction,
         current_position = EXCLUDED.current_position,
         heading = EXCLUDED.heading,
         speed = EXCLUDED.speed,
         last_seen_at = NOW()`,
      [
        userId,
        vehicleId,
        direction,
        position.lng,
        position.lat,
        heading,
        speed,
      ],
    );
  }

  async driverOffline(userId: string): Promise<void> {
    await this.ds.query(
      `UPDATE driver_status SET is_online = false, last_seen_at = NOW() WHERE user_id = $1`,
      [userId],
    );
  }

  async updateDriverPosition(params: {
    userId: string;
    position: PositionDto;
    heading: number | null;
    speed: number | null;
    direction?: Direction | null;
  }): Promise<void> {
    const { userId, position, heading, speed, direction } = params;
    await this.ds.query(
      `UPDATE driver_status SET
         current_position = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
         heading = $4,
         speed = $5,
         direction = COALESCE($6::direction_enum, direction),
         last_seen_at = NOW()
       WHERE user_id = $1`,
      [userId, position.lng, position.lat, heading, speed, direction ?? null],
    );
  }

  async passengerWait(params: {
    userId: string;
    direction: Direction;
    position: PositionDto;
  }): Promise<void> {
    const { userId, direction, position } = params;
    await this.ds.query(
      `INSERT INTO passenger_waits
         (user_id, is_waiting, direction, position, updated_at)
       VALUES ($1, true, $2::direction_enum,
         ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         is_waiting = true,
         direction = EXCLUDED.direction,
         position = EXCLUDED.position,
         updated_at = NOW()`,
      [userId, direction, position.lng, position.lat],
    );
  }

  async cancelPassengerWait(userId: string): Promise<void> {
    await this.ds.query(
      `UPDATE passenger_waits SET is_waiting = false, updated_at = NOW() WHERE user_id = $1`,
      [userId],
    );
  }

  async updatePassengerPosition(params: {
    userId: string;
    position: PositionDto;
  }): Promise<void> {
    const { userId, position } = params;
    await this.ds.query(
      `UPDATE passenger_waits SET
         position = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
         updated_at = NOW()
       WHERE user_id = $1`,
      [userId, position.lng, position.lat],
    );
  }

  async getDriverPosition(userId: string): Promise<{
    lng: number;
    lat: number;
    is_online: boolean;
    direction: Direction | null;
    vehicle_id: string | null;
  } | null> {
    const rows: Array<{
      lng: string;
      lat: string;
      is_online: boolean;
      direction: Direction | null;
      vehicle_id: string | null;
    }> = await this.ds.query(
      `SELECT ST_X(current_position::geometry) AS lng,
              ST_Y(current_position::geometry) AS lat,
              is_online, direction, vehicle_id
       FROM driver_status WHERE user_id = $1`,
      [userId],
    );
    if (!rows[0] || rows[0].lng === null) return null;
    return {
      lng: Number(rows[0].lng),
      lat: Number(rows[0].lat),
      is_online: rows[0].is_online,
      direction: rows[0].direction,
      vehicle_id: rows[0].vehicle_id,
    };
  }

  async getPassengerPosition(userId: string): Promise<{
    lng: number;
    lat: number;
    is_waiting: boolean;
    direction: Direction | null;
  } | null> {
    const rows: Array<{
      lng: string;
      lat: string;
      is_waiting: boolean;
      direction: Direction | null;
    }> = await this.ds.query(
      `SELECT ST_X(position::geometry) AS lng,
              ST_Y(position::geometry) AS lat,
              is_waiting, direction
       FROM passenger_waits WHERE user_id = $1`,
      [userId],
    );
    if (!rows[0] || rows[0].lng === null) return null;
    return {
      lng: Number(rows[0].lng),
      lat: Number(rows[0].lat),
      is_waiting: rows[0].is_waiting,
      direction: rows[0].direction,
    };
  }

  async findNearbyWaitingPassengers(params: {
    direction: Direction;
    lng: number;
    lat: number;
    radiusMeters: number;
  }): Promise<NearbyPassenger[]> {
    const rows: Array<{
      user_id: string;
      full_name: string;
      direction: Direction;
      lng: string;
      lat: string;
      distance_m: string;
    }> = await this.ds.query(
      `SELECT u.id AS user_id, u.full_name, pw.direction,
              ST_X(pw.position::geometry) AS lng,
              ST_Y(pw.position::geometry) AS lat,
              ST_Distance(pw.position, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) AS distance_m
       FROM passenger_waits pw
       JOIN users u ON u.id = pw.user_id
       WHERE pw.is_waiting = true
         AND pw.direction = $1::direction_enum
         AND ST_DWithin(pw.position, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4)`,
      [params.direction, params.lng, params.lat, params.radiusMeters],
    );
    return rows.map((r) => ({
      user_id: r.user_id,
      full_name: r.full_name,
      direction: r.direction,
      lng: Number(r.lng),
      lat: Number(r.lat),
      distance_m: Number(r.distance_m),
    }));
  }

  async findNearbyOnlineDrivers(params: {
    direction: Direction;
    lng: number;
    lat: number;
    radiusMeters: number;
  }): Promise<NearbyDriver[]> {
    const rows: Array<{
      user_id: string;
      full_name: string;
      vehicle_id: string | null;
      plate: string | null;
      direction: Direction;
      lng: string;
      lat: string;
      heading: number | null;
      speed: number | null;
      distance_m: string;
    }> = await this.ds.query(
      `SELECT u.id AS user_id, u.full_name, ds.vehicle_id, v.plate,
              ds.direction,
              ST_X(ds.current_position::geometry) AS lng,
              ST_Y(ds.current_position::geometry) AS lat,
              ds.heading, ds.speed,
              ST_Distance(ds.current_position, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) AS distance_m
       FROM driver_status ds
       JOIN users u ON u.id = ds.user_id
       LEFT JOIN vehicles v ON v.id = ds.vehicle_id
       WHERE ds.is_online = true
         AND ds.direction = $1::direction_enum
         AND ST_DWithin(ds.current_position, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4)`,
      [params.direction, params.lng, params.lat, params.radiusMeters],
    );
    return rows.map((r) => ({
      user_id: r.user_id,
      full_name: r.full_name,
      vehicle_id: r.vehicle_id,
      plate: r.plate,
      direction: r.direction,
      lng: Number(r.lng),
      lat: Number(r.lat),
      heading: r.heading !== null ? Number(r.heading) : null,
      speed: r.speed !== null ? Number(r.speed) : null,
      distance_m: Number(r.distance_m),
    }));
  }

  async recordTripPoint(params: {
    tripId: string;
    seq: number;
    position: PositionDto;
  }): Promise<void> {
    await this.ds.query(
      `INSERT INTO trip_points (trip_id, seq, position)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography)`,
      [params.tripId, params.seq, params.position.lng, params.position.lat],
    );
  }

  async getTripPoints(
    tripId: string,
  ): Promise<Array<{ lng: number; lat: number }>> {
    const rows: Array<{ lng: string; lat: string }> = await this.ds.query(
      `SELECT ST_X(position::geometry) AS lng, ST_Y(position::geometry) AS lat
       FROM trip_points WHERE trip_id = $1 ORDER BY seq ASC`,
      [tripId],
    );
    return rows.map((r) => ({ lng: Number(r.lng), lat: Number(r.lat) }));
  }

  async countTripPoints(tripId: string): Promise<number> {
    const rows: Array<{ count: string }> = await this.ds.query(
      `SELECT COUNT(*)::text AS count FROM trip_points WHERE trip_id = $1`,
      [tripId],
    );
    return parseInt(rows[0]?.count ?? '0', 10);
  }

  distanceMeters(a: PositionDto, b: PositionDto): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
}
