import { Logger, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Direction } from '../../common/types/direction.enum';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import type { AuthenticatedSocket } from '../auth/ws-jwt.guard';
import { LocationsService } from '../locations/locations.service';
import { RealtimeBus } from '../realtime-bus/realtime-bus.service';
import { SettingsService } from '../settings/settings.service';
import { TripsService } from '../trips/trips.service';
import { VehiclesService } from '../vehicles/vehicles.service';

interface DriverOnlinePayload {
  direction: Direction;
  destination?: string | null;
  lng: number;
  lat: number;
  heading?: number | null;
  speed?: number | null;
}

interface DriverPositionPayload {
  lng: number;
  lat: number;
  heading?: number | null;
  speed?: number | null;
  direction?: Direction | null;
}

interface PassengerWaitPayload {
  direction: Direction;
  destination?: string | null;
  lng: number;
  lat: number;
}

interface PassengerPositionPayload {
  lng: number;
  lat: number;
}

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly lastBroadcast = new Map<string, number>();
  private readonly BROADCAST_THROTTLE_MS = 2000;

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly wsGuard: WsJwtGuard,
    private readonly locations: LocationsService,
    private readonly vehicles: VehiclesService,
    private readonly trips: TripsService,
    private readonly bus: RealtimeBus,
    private readonly settings: SettingsService,
  ) {}

  private get nearbyRadiusMeters(): number {
    return this.settings.getNumber('app.nearbyDriversRadiusMeters', 3000);
  }

  afterInit(server: Server): void {
    this.bus.registerServer(server);
    this.logger.log('Realtime gateway initialized');
  }

  handleConnection(client: AuthenticatedSocket): void {
    try {
      this.wsGuard.authenticate(client);
      const userId = client.data.user.id;
      const role = client.data.user.role;
      void client.join(`user:${userId}`);
      if (role) {
        // Lets the back-end fan-out role-wide events (e.g. notify all
        // admins of a new wallet request) without keeping a registry.
        void client.join(`role:${role}`);
      }
      this.logger.log(
        `Client connected: user=${userId} role=${role} sid=${client.id}`,
      );
    } catch (err) {
      this.logger.warn(
        `Rejected unauthenticated socket ${client.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    const userId = client.data?.user?.id;
    if (!userId) return;
    try {
      await this.locations.driverOffline(userId);
      await this.locations.cancelPassengerWait(userId);
      await this.notifyDriverRemoved(userId);
      await this.notifyPassengerRemoved(userId);
    } catch (err) {
      this.logger.warn(
        `Cleanup on disconnect failed for ${userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('driver:online')
  async onDriverOnline(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: DriverOnlinePayload,
  ): Promise<{ ok: true }> {
    const userId = client.data.user.id;
    const vehicle = await this.vehicles.getForUserStrict(userId);
    await this.locations.driverOnline({
      userId,
      vehicleId: vehicle.id,
      direction: data.direction,
      destination: data.destination ?? null,
      position: { lng: data.lng, lat: data.lat },
      heading: data.heading ?? null,
      speed: data.speed ?? null,
    });
    void client.join(`drivers:${data.direction}`);
    await this.broadcastDriver(userId);
    await this.pushNearbyPassengersToDriver(userId);
    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('driver:offline')
  async onDriverOffline(
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<{ ok: true }> {
    const userId = client.data.user.id;
    await this.locations.driverOffline(userId);
    await this.notifyDriverRemoved(userId);
    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('driver:position')
  async onDriverPosition(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: DriverPositionPayload,
  ): Promise<{ ok: true }> {
    const userId = client.data.user.id;
    await this.locations.updateDriverPosition({
      userId,
      position: { lng: data.lng, lat: data.lat },
      heading: data.heading ?? null,
      speed: data.speed ?? null,
      direction: data.direction ?? null,
    });
    if (this.shouldBroadcast(userId)) {
      await this.broadcastDriver(userId);
    }
    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('passenger:wait')
  async onPassengerWait(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: PassengerWaitPayload,
  ): Promise<{ ok: true }> {
    const userId = client.data.user.id;
    await this.locations.passengerWait({
      userId,
      direction: data.direction,
      destination: data.destination ?? null,
      position: { lng: data.lng, lat: data.lat },
    });
    void client.join(`passengers:${data.direction}`);
    await this.broadcastPassenger(userId);
    await this.pushNearbyDriversToPassenger(userId);
    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('passenger:cancel_wait')
  async onPassengerCancel(
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<{ ok: true }> {
    const userId = client.data.user.id;
    await this.locations.cancelPassengerWait(userId);
    await this.notifyPassengerRemoved(userId);
    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('passenger:position')
  async onPassengerPosition(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: PassengerPositionPayload,
  ): Promise<{ ok: true; trip_id: string | null }> {
    const userId = client.data.user.id;
    const position = { lng: data.lng, lat: data.lat };
    await this.locations.updatePassengerPosition({ userId, position });

    const tripId = await this.trips.recordPassengerPointIfActive(
      userId,
      position,
    );

    if (!tripId && this.shouldBroadcast(userId)) {
      await this.broadcastPassenger(userId);
    }
    return { ok: true, trip_id: tripId };
  }

  private shouldBroadcast(userId: string): boolean {
    const now = Date.now();
    const last = this.lastBroadcast.get(userId) ?? 0;
    if (now - last < this.BROADCAST_THROTTLE_MS) return false;
    this.lastBroadcast.set(userId, now);
    return true;
  }

  private async broadcastDriver(driverUserId: string): Promise<void> {
    const radius = this.nearbyRadiusMeters;
    const pos = await this.locations.getDriverPosition(driverUserId);
    if (!pos || !pos.is_online || !pos.direction) return;

    const vehicle = await this.vehicles.getFirstForUser(driverUserId);
    const nearby = await this.locations.findNearbyWaitingPassengers({
      direction: pos.direction,
      lng: pos.lng,
      lat: pos.lat,
      radiusMeters: radius,
    });
    if (nearby.length === 0) return;
    const payload = {
      user_id: driverUserId,
      vehicle_id: pos.vehicle_id,
      plate: vehicle?.plate ?? null,
      model: vehicle?.model ?? null,
      color: vehicle?.color ?? null,
      direction: pos.direction,
      destination: pos.destination,
      lng: pos.lng,
      lat: pos.lat,
    };
    this.bus.emitToUsers(
      nearby.map((n) => n.user_id),
      'drivers:update',
      payload,
    );
  }

  private async broadcastPassenger(passengerUserId: string): Promise<void> {
    const radius = this.nearbyRadiusMeters;
    const pos = await this.locations.getPassengerPosition(passengerUserId);
    if (!pos || !pos.is_waiting || !pos.direction) return;
    const nearby = await this.locations.findNearbyOnlineDrivers({
      direction: pos.direction,
      lng: pos.lng,
      lat: pos.lat,
      radiusMeters: radius,
    });
    if (nearby.length === 0) return;
    const payload = {
      user_id: passengerUserId,
      direction: pos.direction,
      destination: pos.destination,
      lng: pos.lng,
      lat: pos.lat,
    };
    this.bus.emitToUsers(
      nearby.map((n) => n.user_id),
      'passengers:update',
      payload,
    );
  }

  private async notifyDriverRemoved(driverUserId: string): Promise<void> {
    const radius = this.nearbyRadiusMeters;
    const pos = await this.locations.getDriverPosition(driverUserId);
    if (!pos || !pos.direction) return;
    const nearby = await this.locations.findNearbyWaitingPassengers({
      direction: pos.direction,
      lng: pos.lng,
      lat: pos.lat,
      radiusMeters: radius,
    });
    this.bus.emitToUsers(
      nearby.map((n) => n.user_id),
      'driver:removed',
      { user_id: driverUserId },
    );
  }

  private async notifyPassengerRemoved(passengerUserId: string): Promise<void> {
    const radius = this.nearbyRadiusMeters;
    const pos = await this.locations.getPassengerPosition(passengerUserId);
    if (!pos || !pos.direction) return;
    const nearby = await this.locations.findNearbyOnlineDrivers({
      direction: pos.direction,
      lng: pos.lng,
      lat: pos.lat,
      radiusMeters: radius,
    });
    this.bus.emitToUsers(
      nearby.map((n) => n.user_id),
      'passenger:removed',
      { user_id: passengerUserId },
    );
  }

  private async pushNearbyDriversToPassenger(
    passengerUserId: string,
  ): Promise<void> {
    const radius = this.nearbyRadiusMeters;
    const pos = await this.locations.getPassengerPosition(passengerUserId);
    if (!pos || !pos.direction) return;
    const drivers = await this.locations.findNearbyOnlineDrivers({
      direction: pos.direction,
      lng: pos.lng,
      lat: pos.lat,
      radiusMeters: radius,
    });
    this.bus.emitToUser(passengerUserId, 'drivers:snapshot', {
      drivers: drivers.map((d) => ({
        user_id: d.user_id,
        vehicle_id: d.vehicle_id,
        plate: d.plate,
        model: d.model,
        color: d.color,
        direction: d.direction,
        destination: d.destination,
        lng: d.lng,
        lat: d.lat,
        heading: d.heading,
        speed: d.speed,
      })),
    });
  }

  private async pushNearbyPassengersToDriver(
    driverUserId: string,
  ): Promise<void> {
    const radius = this.nearbyRadiusMeters;
    const pos = await this.locations.getDriverPosition(driverUserId);
    if (!pos || !pos.is_online || !pos.direction) return;
    const passengers = await this.locations.findNearbyWaitingPassengers({
      direction: pos.direction,
      lng: pos.lng,
      lat: pos.lat,
      radiusMeters: radius,
    });
    this.bus.emitToUser(driverUserId, 'passengers:snapshot', {
      passengers: passengers.map((p) => ({
        user_id: p.user_id,
        direction: p.direction,
        destination: p.destination,
        lng: p.lng,
        lat: p.lat,
      })),
    });
  }
}
