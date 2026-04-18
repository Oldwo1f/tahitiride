import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface GeoPoint {
  lng: number;
  lat: number;
}

interface MapMatchingResponse {
  code: string;
  matchings?: Array<{
    distance: number;
    duration: number;
    geometry: string;
  }>;
}

@Injectable()
export class MapboxService {
  private readonly logger = new Logger(MapboxService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async computeDistanceMeters(points: GeoPoint[]): Promise<number> {
    if (points.length < 2) return 0;
    const token = this.config.get<string>('mapbox.token');
    if (!token) {
      this.logger.warn(
        'MAPBOX_TOKEN not set, falling back to Haversine distance',
      );
      return this.haversineTotal(points);
    }

    const chunks = this.chunk(points, 100);
    let total = 0;
    try {
      for (const chunk of chunks) {
        total += await this.matchChunk(chunk, token);
      }
      return total;
    } catch (err) {
      this.logger.warn(
        `Map Matching API failed, falling back to Haversine: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return this.haversineTotal(points);
    }
  }

  private async matchChunk(points: GeoPoint[], token: string): Promise<number> {
    const coords = points
      .map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`)
      .join(';');
    const radiuses = points.map(() => '25').join(';');
    const url = `https://api.mapbox.com/matching/v5/mapbox/driving/${coords}`;
    const { data } = await firstValueFrom(
      this.http.get<MapMatchingResponse>(url, {
        params: {
          access_token: token,
          geometries: 'polyline',
          overview: 'full',
          radiuses,
        },
        timeout: 8000,
      }),
    );
    if (data.code !== 'Ok' || !data.matchings?.length) {
      throw new Error(`Mapbox response code=${data.code}`);
    }
    return data.matchings.reduce((s, m) => s + (m.distance || 0), 0);
  }

  private haversineTotal(points: GeoPoint[]): number {
    let sum = 0;
    for (let i = 1; i < points.length; i++) {
      sum += this.haversine(points[i - 1], points[i]);
    }
    return sum;
  }

  private haversine(a: GeoPoint, b: GeoPoint): number {
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

  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      out.push(arr.slice(i, i + size));
    }
    return out;
  }
}
