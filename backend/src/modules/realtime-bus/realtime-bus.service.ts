import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

@Injectable()
export class RealtimeBus {
  private readonly logger = new Logger(RealtimeBus.name);
  private server: Server | null = null;

  registerServer(server: Server): void {
    this.server = server;
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    if (!this.server) {
      this.logger.warn(`emitToUser called before server init (${event})`);
      return;
    }
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitToUsers(userIds: string[], event: string, payload: unknown): void {
    if (!this.server || userIds.length === 0) return;
    const rooms = userIds.map((id) => `user:${id}`);
    this.server.to(rooms).emit(event, payload);
  }

  /**
   * Emit to every connected client whose JWT carried the given role.
   * Clients join their `role:<role>` room automatically in
   * `RealtimeGateway.handleConnection`. Used for fan-out to all admins
   * (e.g. badge updates, new wallet request notifications).
   */
  emitToRole(role: string, event: string, payload: unknown): void {
    if (!this.server) {
      this.logger.warn(`emitToRole called before server init (${event})`);
      return;
    }
    this.server.to(`role:${role}`).emit(event, payload);
  }
}
