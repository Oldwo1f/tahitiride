import type { Point } from 'geojson';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TripStatus } from '../../common/types/direction.enum';
import { Trip } from '../../entities/trip.entity';
import { LocationsService, PositionDto } from '../locations/locations.service';
import { MapboxService } from '../mapbox/mapbox.service';
import { PricingService } from '../pricing/pricing.service';
import { QrService } from '../qr/qr.service';
import { RealtimeBus } from '../realtime-bus/realtime-bus.service';
import { WalletService } from '../wallet/wallet.service';
import type { DropoffDto, PickupDto } from './dto/pickup.dto';

const toPoint = (p: PositionDto): Point => ({
  type: 'Point',
  coordinates: [p.lng, p.lat],
});

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    @InjectRepository(Trip) private readonly trips: Repository<Trip>,
    private readonly qr: QrService,
    private readonly locations: LocationsService,
    private readonly mapbox: MapboxService,
    private readonly pricing: PricingService,
    private readonly wallet: WalletService,
    private readonly bus: RealtimeBus,
    private readonly config: ConfigService,
    private readonly ds: DataSource,
  ) {}

  async pickup(passengerId: string, dto: PickupDto): Promise<Trip> {
    if (passengerId === undefined) {
      throw new BadRequestException('Missing passenger');
    }

    const payload = await this.qr.validate(dto.qr_token);
    const passengerPos: PositionDto = { lng: dto.lng, lat: dto.lat };

    const existingActive = await this.trips.findOne({
      where: [
        { passenger_id: passengerId, status: TripStatus.ACTIVE },
        { driver_id: passengerId, status: TripStatus.ACTIVE },
      ],
    });
    if (existingActive) {
      throw new ConflictException('You already have an active trip');
    }

    if (passengerId === payload.did) {
      throw new BadRequestException('Cannot pickup yourself');
    }

    const driverPos = await this.locations.getDriverPosition(payload.did);
    if (!driverPos || !driverPos.is_online) {
      throw new BadRequestException('Driver is not online');
    }

    const distance = this.locations.distanceMeters(passengerPos, driverPos);
    const maxDist = this.config.get<number>('app.pickupMaxDistanceMeters', 50);
    if (distance > maxDist) {
      throw new BadRequestException(
        `Too far from driver (${Math.round(distance)}m > ${maxDist}m)`,
      );
    }

    const replay = await this.trips.findOne({
      where: { pickup_token_jti: payload.jti },
    });
    if (replay) {
      throw new ConflictException('QR token already used');
    }

    const trip = await this.trips.save(
      this.trips.create({
        passenger_id: passengerId,
        driver_id: payload.did,
        vehicle_id: payload.vid,
        status: TripStatus.ACTIVE,
        start_point: toPoint(passengerPos),
        pickup_token_jti: payload.jti,
      }),
    );

    await this.locations.recordTripPoint({
      tripId: trip.id,
      seq: 0,
      position: passengerPos,
    });

    await this.locations.cancelPassengerWait(passengerId);

    this.bus.emitToUsers([passengerId, payload.did], 'trip:started', {
      trip_id: trip.id,
      passenger_id: passengerId,
      driver_id: payload.did,
      vehicle_id: payload.vid,
      started_at: trip.started_at,
    });

    return trip;
  }

  async dropoff(
    passengerId: string,
    tripId: string,
    dto: DropoffDto,
  ): Promise<Trip> {
    const trip = await this.trips.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.passenger_id !== passengerId) {
      throw new ForbiddenException();
    }
    if (trip.status !== TripStatus.ACTIVE) {
      throw new BadRequestException('Trip is not active');
    }

    const payload = await this.qr.validate(dto.qr_token);
    if (payload.vid !== trip.vehicle_id || payload.did !== trip.driver_id) {
      throw new BadRequestException('QR does not match trip driver/vehicle');
    }
    if (payload.jti === trip.pickup_token_jti) {
      throw new BadRequestException(
        'Cannot use the same QR token for pickup and dropoff',
      );
    }

    const dropoffPos: PositionDto = { lng: dto.lng, lat: dto.lat };

    const nextSeq = await this.locations.countTripPoints(tripId);
    await this.locations.recordTripPoint({
      tripId,
      seq: nextSeq,
      position: dropoffPos,
    });

    const points = await this.locations.getTripPoints(tripId);
    const distance = await this.mapbox.computeDistanceMeters(points);
    const fare = this.pricing.computeFare(distance);

    let settled: { debited: number; remaining: number } | null = null;
    try {
      settled = await this.wallet.settleTrip({
        tripId,
        passengerId,
        driverId: trip.driver_id,
        fareXpf: fare,
      });
    } catch (err) {
      this.logger.error(
        `Wallet settle failed for trip ${tripId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    trip.status = TripStatus.COMPLETED;
    trip.ended_at = new Date();
    trip.end_point = toPoint(dropoffPos);
    trip.distance_m = distance;
    trip.fare_xpf = settled?.debited ?? fare;
    trip.dropoff_token_jti = payload.jti;
    await this.trips.save(trip);

    this.bus.emitToUsers([passengerId, trip.driver_id], 'trip:completed', {
      trip_id: trip.id,
      distance_m: trip.distance_m,
      fare_xpf: trip.fare_xpf,
      ended_at: trip.ended_at,
    });

    return trip;
  }

  async findActive(userId: string): Promise<Trip | null> {
    return this.trips.findOne({
      where: [
        { passenger_id: userId, status: TripStatus.ACTIVE },
        { driver_id: userId, status: TripStatus.ACTIVE },
      ],
    });
  }

  async findById(tripId: string, userId: string): Promise<Trip> {
    const trip = await this.trips.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.passenger_id !== userId && trip.driver_id !== userId) {
      throw new ForbiddenException();
    }
    return trip;
  }

  async recordPassengerPointIfActive(
    passengerId: string,
    position: PositionDto,
  ): Promise<string | null> {
    const trip = await this.findActive(passengerId);
    if (!trip || trip.passenger_id !== passengerId) return null;
    const seq = await this.locations.countTripPoints(trip.id);
    await this.locations.recordTripPoint({
      tripId: trip.id,
      seq,
      position,
    });
    return trip.id;
  }

  async listMine(userId: string, limit = 20): Promise<Trip[]> {
    return this.ds.getRepository(Trip).find({
      where: [{ passenger_id: userId }, { driver_id: userId }],
      order: { started_at: 'DESC' },
      take: Math.min(limit, 100),
    });
  }
}
