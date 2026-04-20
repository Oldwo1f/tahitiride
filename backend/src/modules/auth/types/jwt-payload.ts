export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  /**
   * Current driver-mode flag baked into the JWT for fast access. The
   * canonical source of truth stays on the user row — guards that
   * care (admin routes, future driver-only endpoints) refresh it
   * from the DB to avoid stale-token issues.
   */
  is_driver?: boolean;
}
