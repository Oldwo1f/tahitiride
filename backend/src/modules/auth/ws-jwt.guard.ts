import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import type { JwtPayload } from './types/jwt-payload';

export interface SocketUserData {
  user: { id: string; email: string; role: string };
}

export type AuthenticatedSocket = Socket<
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>,
  SocketUserData
>;

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    if (client.data?.user) return true;
    return this.authenticate(client);
  }

  authenticate(client: AuthenticatedSocket): boolean {
    const token =
      (client.handshake.auth as { token?: string } | undefined)?.token ||
      (client.handshake.headers.authorization || '').replace(/^Bearer /, '');
    if (!token) throw new UnauthorizedException('No token');
    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get<string>('jwt.secret'),
      });
      client.data.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
