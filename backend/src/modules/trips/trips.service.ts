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
import { v4 as uuidv4 } from 'uuid';
import { TripStatus } from '../../common/types/direction.enum';
import { Trip } from '../../entities/trip.entity';
import { LocationsService, PositionDto } from '../locations/locations.service';
import { MapboxService } from '../mapbox/mapbox.service';
import { PricingService } from '../pricing/pricing.service';
import { QrService } from '../qr/qr.service';
import { RealtimeBus } from '../realtime-bus/realtime-bus.service';
import { WalletService } from '../wallet/wallet.service';
import type {
  EstimateDto,
  EstimateResponseDto,
} from './dto/estimate.dto';
import type { DropoffDto, PickupDto } from './dto/pickup.dto';
import type { TripSummaryDto } from './dto/trip-summary.dto';

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

    if (passengerId === payload.did) {
      throw new BadRequestException('Cannot pickup yourself');
    }

    // The QR is now permanent (printed in the vehicle), so we can no longer
    // rely on token rotation for anti-replay. Instead we enforce: the
    // passenger has no other active trip, AND the scanned driver has no
    // other active trip (otherwise two passengers could "share" a single
    // active driver simultaneously).
    const existingActive = await this.trips.findOne({
      where: [
        { passenger_id: passengerId, status: TripStatus.ACTIVE },
        { driver_id: passengerId, status: TripStatus.ACTIVE },
        { driver_id: payload.did, status: TripStatus.ACTIVE },
      ],
    });
    if (existingActive) {
      if (existingActive.driver_id === payload.did) {
        throw new ConflictException('Driver already has an active trip');
      }
      throw new ConflictException('You already have an active trip');
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

    const trip = await this.trips.save(
      this.trips.create({
        passenger_id: passengerId,
        driver_id: payload.did,
        vehicle_id: payload.vid,
        status: TripStatus.ACTIVE,
        start_point: toPoint(passengerPos),
        // Per-scan unique id (kept for traceability and to satisfy the
        // existing UNIQUE INDEX on the column).
        pickup_token_jti: uuidv4(),
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

    // The QR is permanent, so a passenger could theoretically scan twice in
    // a row to settle a 0-meter "fake" trip. Enforce a minimum delay
    // between pickup and dropoff to defeat that.
    const minDelayMs =
      this.config.get<number>('app.dropoffMinDelaySeconds', 30) * 1000;
    const elapsedMs = Date.now() - new Date(trip.started_at).getTime();
    if (elapsedMs < minDelayMs) {
      const wait = Math.ceil((minDelayMs - elapsedMs) / 1000);
      throw new BadRequestException(
        `Trop tôt pour terminer le trajet (encore ${wait}s)`,
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
    const driverShare = this.pricing.computeDriverShare(distance);

    let settled: {
      debited: number;
      driverCredited: number;
      platformMargin: number;
      remaining: number;
    } | null = null;
    try {
      settled = await this.wallet.settleTrip({
        tripId,
        passengerId,
        driverId: trip.driver_id,
        fareXpf: fare,
        driverShareXpf: driverShare,
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
    trip.driver_share_xpf = settled?.driverCredited ?? driverShare;
    // Per-scan unique id (also satisfies the partial UNIQUE INDEX on the
    // column).
    trip.dropoff_token_jti = uuidv4();
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

  /**
   * Compute a passenger-facing estimate (distance, duration, fare) for a
   * proposed trip from `from` to `to`. Used to inform the user up-front when
   * they pick a destination on the map.
   */
  async estimate(dto: EstimateDto): Promise<EstimateResponseDto> {
    const route = await this.mapbox.estimateRoute(
      { lng: dto.from_lng, lat: dto.from_lat },
      { lng: dto.to_lng, lat: dto.to_lat },
    );
    return {
      distance_m: Math.round(route.distance_m),
      duration_s: Math.round(route.duration_s),
      fare_xpf: this.pricing.computeFare(route.distance_m),
    };
  }

  async listMine(userId: string, limit = 20): Promise<TripSummaryDto[]> {
    const trips = await this.trips.find({
      where: [{ passenger_id: userId }, { driver_id: userId }],
      relations: { passenger: true, driver: true, vehicle: true },
      order: { started_at: 'DESC' },
      take: Math.min(limit, 100),
    });

    return trips.map<TripSummaryDto>((t) => {
      const myRole: 'passenger' | 'driver' =
        t.passenger_id === userId ? 'passenger' : 'driver';
      const partner = myRole === 'passenger' ? t.driver : t.passenger;
      return {
        id: t.id,
        passenger_id: t.passenger_id,
        driver_id: t.driver_id,
        vehicle_id: t.vehicle_id,
        status: t.status,
        started_at: t.started_at,
        ended_at: t.ended_at,
        distance_m: t.distance_m,
        fare_xpf: t.fare_xpf,
        driver_share_xpf: t.driver_share_xpf,
        my_role: myRole,
        partner_id: partner?.id ?? (myRole === 'passenger' ? t.driver_id : t.passenger_id),
        partner_name: partner?.full_name ?? 'Inconnu',
        vehicle_plate: t.vehicle?.plate ?? null,
        vehicle_model: t.vehicle?.model ?? null,
        vehicle_color: t.vehicle?.color ?? null,
      };
    });
  }
}
