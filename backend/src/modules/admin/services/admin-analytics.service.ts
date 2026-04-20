import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface CountRow {
  count: string;
}

interface SeriesRow {
  d: Date;
  count: string;
}

interface RoleRow {
  role: string;
  count: string;
}

interface SumRow {
  sum: string | null;
}

interface TopDriverRow {
  driver_id: string;
  email: string;
  full_name: string;
  trips: string;
  driver_revenue_xpf: string | null;
}

@Injectable()
export class AdminAnalyticsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * Single roundtrip-friendly snapshot used by the admin dashboard. Keep
   * additions read-only and bounded — this endpoint is hit on every page
   * load of the back-office home.
   */
  async overview() {
    const [
      usersTotal,
      usersByRole,
      driversTotal,
      signups30d,
      tripsTotal,
      tripsByStatus,
      trips30d,
      revenue30d,
      walletTotal,
      topDrivers,
    ] = await Promise.all([
      this.ds.query<CountRow[]>(
        `SELECT COUNT(*)::text AS count FROM users WHERE deleted_at IS NULL`,
      ),
      this.ds.query<RoleRow[]>(
        `SELECT role::text AS role, COUNT(*)::text AS count
         FROM users WHERE deleted_at IS NULL GROUP BY role`,
      ),
      this.ds.query<CountRow[]>(
        `SELECT COUNT(*)::text AS count
         FROM users
         WHERE deleted_at IS NULL AND is_driver = TRUE`,
      ),
      this.ds.query<SeriesRow[]>(
        `SELECT date_trunc('day', created_at) AS d, COUNT(*)::text AS count
         FROM users
         WHERE deleted_at IS NULL
           AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY 1 ORDER BY 1`,
      ),
      this.ds.query<CountRow[]>(`SELECT COUNT(*)::text AS count FROM trips`),
      this.ds.query<RoleRow[]>(
        `SELECT status::text AS role, COUNT(*)::text AS count
         FROM trips GROUP BY status`,
      ),
      this.ds.query<SeriesRow[]>(
        `SELECT date_trunc('day', started_at) AS d, COUNT(*)::text AS count
         FROM trips
         WHERE started_at >= NOW() - INTERVAL '30 days'
         GROUP BY 1 ORDER BY 1`,
      ),
      this.ds.query<SumRow[]>(
        `SELECT COALESCE(SUM(fare_xpf - COALESCE(driver_share_xpf, 0)), 0)::text AS sum
         FROM trips
         WHERE status = 'completed'
           AND started_at >= NOW() - INTERVAL '30 days'`,
      ),
      this.ds.query<SumRow[]>(
        `SELECT COALESCE(SUM(balance_xpf), 0)::text AS sum
         FROM wallets w
         JOIN users u ON u.id = w.user_id
         WHERE u.deleted_at IS NULL`,
      ),
      this.ds.query<TopDriverRow[]>(
        `SELECT t.driver_id,
                u.email,
                u.full_name,
                COUNT(*)::text AS trips,
                COALESCE(SUM(t.driver_share_xpf), 0)::text AS driver_revenue_xpf
         FROM trips t
         JOIN users u ON u.id = t.driver_id
         WHERE t.status = 'completed'
           AND t.started_at >= NOW() - INTERVAL '30 days'
         GROUP BY t.driver_id, u.email, u.full_name
         ORDER BY COUNT(*) DESC
         LIMIT 5`,
      ),
    ]);

    const roleCounts: Record<string, number> = {};
    for (const r of usersByRole) roleCounts[r.role] = Number(r.count);

    const statusCounts: Record<string, number> = {};
    for (const r of tripsByStatus) statusCounts[r.role] = Number(r.count);

    return {
      users: {
        total: Number(usersTotal[0]?.count ?? 0),
        by_role: roleCounts,
        drivers: Number(driversTotal[0]?.count ?? 0),
        signups_last_30d: signups30d.map((r) => ({
          date: r.d,
          count: Number(r.count),
        })),
      },
      trips: {
        total: Number(tripsTotal[0]?.count ?? 0),
        by_status: statusCounts,
        per_day_30d: trips30d.map((r) => ({
          date: r.d,
          count: Number(r.count),
        })),
      },
      finance: {
        platform_revenue_30d_xpf: Number(revenue30d[0]?.sum ?? 0),
        wallet_total_balance_xpf: Number(walletTotal[0]?.sum ?? 0),
      },
      top_drivers: topDrivers.map((r) => ({
        driver_id: r.driver_id,
        email: r.email,
        full_name: r.full_name,
        trips: Number(r.trips),
        driver_revenue_xpf: Number(r.driver_revenue_xpf ?? 0),
      })),
    };
  }
}
