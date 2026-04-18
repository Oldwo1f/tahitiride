import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  env: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  fareBaseXpf: parseInt(process.env.FARE_BASE_XPF || '200', 10),
  farePerKmXpf: parseInt(process.env.FARE_PER_KM_XPF || '100', 10),
  initialWalletBalanceXpf: parseInt(
    process.env.INITIAL_WALLET_BALANCE_XPF || '10000',
    10,
  ),
  pickupMaxDistanceMeters: parseInt(
    process.env.PICKUP_MAX_DISTANCE_METERS || '50',
    10,
  ),
  dropoffMinDelaySeconds: parseInt(
    process.env.DROPOFF_MIN_DELAY_SECONDS || '30',
    10,
  ),
  nearbyDriversRadiusMeters: parseInt(
    process.env.NEARBY_DRIVERS_RADIUS_METERS || '3000',
    10,
  ),
}));
