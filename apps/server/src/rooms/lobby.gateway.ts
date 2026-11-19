import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { LobbyAck, RoomState } from '@shadow-front/shared-types';
import { LobbyError, RoomsService } from './rooms.service';

type Payload = Record<string, unknown>;

const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',');

/** Socket.IO namespace `/lobby`. Every event replies through the acknowledgement callback. */
@WebSocketGateway({ namespace: '/lobby', cors: { origin: corsOrigins } })
export class LobbyGateway implements OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(LobbyGateway.name);
  /** Simple per-socket rate limit: max events per second. */
  private readonly rate = new Map<string, { t: number; n: number }>();

  constructor(private readonly rooms: RoomsService) {}

  private run(client: Socket, fn: () => RoomState | null): LobbyAck {
    const now = Date.now();
    const r = this.rate.get(client.id) ?? { t: now, n: 0 };
    if (now - r.t > 1000) {
      r.t = now;
      r.n = 0;
    }
    r.n++;
    this.rate.set(client.id, r);
    if (r.n > 20) return { ok: false, error: 'INVALID_PAYLOAD' };
    try {
      const before = this.rooms.roomOf(client.id)?.id;
      const room = fn();
      if (before && before !== room?.id) {
        void client.leave(before);
        this.broadcast(before);
      }
      if (room) {
        void client.join(room.id);
        this.server.to(room.id).emit('room:state', room);
      }
      return { ok: true, room: room ?? undefined };
    } catch (e) {
      if (e instanceof LobbyError) return { ok: false, error: e.code };
      this.logger.error(e);
      return { ok: false, error: 'INVALID_PAYLOAD' };
    }
  }

  private broadcast(roomId: string): void {
    try {
      this.server.to(roomId).emit('room:state', this.rooms.get(roomId));
    } catch {
      // Room closed.
    }
  }

  handleDisconnect(client: Socket): void {
    this.rate.delete(client.id);
    const room = this.rooms.leave(client.id);
    if (room) this.server.to(room.id).emit('room:state', room);
  }

  @SubscribeMessage('room:list')
  list(): LobbyAck {
    return { ok: true, rooms: this.rooms.list() };
  }

  @SubscribeMessage('room:create')
  create(@ConnectedSocket() c: Socket, @MessageBody() body: Payload): LobbyAck {
    return this.run(c, () => this.rooms.create(c.id, body ?? {}));
  }

  @SubscribeMessage('room:join')
  join(@ConnectedSocket() c: Socket, @MessageBody() body: Payload): LobbyAck {
    return this.run(c, () => this.rooms.join(c.id, body ?? {}));
  }

  @SubscribeMessage('room:leave')
  leave(@ConnectedSocket() c: Socket): LobbyAck {
    return this.run(c, () => {
      const id = this.rooms.roomOf(c.id)?.id;
      const room = this.rooms.leave(c.id);
      if (id) void c.leave(id);
      if (room) this.server.to(room.id).emit('room:state', room);
      return null;
    });
  }

  @SubscribeMessage('player:ready')
  ready(@ConnectedSocket() c: Socket, @MessageBody() body: Payload): LobbyAck {
    return this.run(c, () => this.rooms.setReady(c.id, body?.ready));
  }

  @SubscribeMessage('player:faction')
  faction(@ConnectedSocket() c: Socket, @MessageBody() body: Payload): LobbyAck {
    return this.run(c, () => this.rooms.setFaction(c.id, body?.faction));
  }

  @SubscribeMessage('room:settings')
  settings(@ConnectedSocket() c: Socket, @MessageBody() body: Payload): LobbyAck {
    return this.run(c, () => this.rooms.updateSettings(c.id, body ?? {}));
  }

  @SubscribeMessage('room:addBot')
  addBot(@ConnectedSocket() c: Socket, @MessageBody() body: Payload): LobbyAck {
    return this.run(c, () => this.rooms.addBot(c.id, body ?? {}));
  }

  @SubscribeMessage('room:removeBot')
  removeBot(@ConnectedSocket() c: Socket, @MessageBody() body: Payload): LobbyAck {
    return this.run(c, () => this.rooms.removeBot(c.id, body?.botId));
  }

  @SubscribeMessage('room:start')
  start(@ConnectedSocket() c: Socket): LobbyAck {
    return this.run(c, () => this.rooms.start(c.id));
  }
}
