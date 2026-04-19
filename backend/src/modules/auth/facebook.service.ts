import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

export interface FacebookProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  name: string;
}

interface GraphMeResponse {
  id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  error?: { message?: string; type?: string; code?: number };
}

/**
 * Verifies a short-lived Facebook access token by calling the Graph
 * API server-side. Using the JS SDK alone would be insecure: anyone
 * could call our `/api/auth/facebook` endpoint with a forged user id.
 * Hitting `/me` with the user-supplied token forces Facebook to
 * authenticate the request, and `appsecret_proof` proves the call is
 * coming from our backend (recommended by Meta to prevent token
 * replay if a token leaks client-side).
 */
@Injectable()
export class FacebookService {
  private readonly logger = new Logger(FacebookService.name);

  constructor(private readonly config: ConfigService) {}

  async verifyAccessToken(accessToken: string): Promise<FacebookProfile> {
    const appId = this.config.get<string>('facebook.appId') || '';
    const appSecret = this.config.get<string>('facebook.appSecret') || '';
    const version = this.config.get<string>('facebook.graphVersion') || 'v20.0';

    if (!appId || !appSecret) {
      throw new ServiceUnavailableException('Facebook login not configured');
    }
    if (!accessToken || accessToken.length < 20) {
      throw new UnauthorizedException('Invalid Facebook token');
    }

    const proof = createHmac('sha256', appSecret)
      .update(accessToken)
      .digest('hex');

    const url =
      `https://graph.facebook.com/${version}/me` +
      `?fields=id,email,first_name,last_name,name` +
      `&access_token=${encodeURIComponent(accessToken)}` +
      `&appsecret_proof=${proof}`;

    let res: Response;
    try {
      res = await fetch(url, { method: 'GET' });
    } catch (err) {
      this.logger.error('Facebook Graph API unreachable', err as Error);
      throw new ServiceUnavailableException('Facebook unreachable');
    }

    let body: GraphMeResponse;
    try {
      body = (await res.json()) as GraphMeResponse;
    } catch {
      throw new UnauthorizedException('Invalid Facebook response');
    }

    if (!res.ok || body.error || !body.id) {
      this.logger.warn(
        `Facebook token rejected (status=${res.status}, error=${body.error?.message ?? 'n/a'})`,
      );
      throw new UnauthorizedException('Invalid Facebook token');
    }

    if (!body.email) {
      // Without email we cannot reconcile with an existing local
      // account, and our `users.email` column is NOT NULL + UNIQUE.
      // Asking the user to re-login with the email permission is the
      // cleanest UX (the SDK call already requests `scope: 'email'`,
      // so this only triggers if they explicitly denied it).
      throw new UnauthorizedException('Facebook account has no email');
    }

    return {
      id: body.id,
      email: body.email.toLowerCase(),
      first_name: body.first_name?.trim() || null,
      last_name: body.last_name?.trim() || null,
      name: (body.name?.trim() || body.email).slice(0, 120),
    };
  }
}
