import { registerAs } from '@nestjs/config';

export default registerAs('mapbox', () => ({
  token: process.env.MAPBOX_TOKEN || '',
}));
