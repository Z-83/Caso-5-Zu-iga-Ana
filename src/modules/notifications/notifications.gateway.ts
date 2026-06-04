import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConnectedUsersService } from './connected-users.service';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    @Inject(ConnectedUsersService)
    private readonly connectedUsersService: ConnectedUsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.cleanupInterval = setInterval(() => this.checkExpiredTokens(), 60000);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }

  private checkExpiredTokens() {
    const sockets = this.server.of('/notifications').sockets;
    const now = Math.floor(Date.now() / 1000);
    sockets.forEach((socket: Socket) => {
      const user = socket.data.user;
      if (user && user.exp && now >= user.exp) {
        socket.emit('session_expired', { message: 'Sesion expirada.' });
        socket.disconnect(true);
      }
    });
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractTokenFromSocket(client);
      if (!token) {
        client.disconnect(true);
        return;
      }
      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = this.jwtService.verify(token, { secret });
      const userId = payload.sub;
      const email = payload.email;
      client.data.userId = userId;
      client.data.email = email;
      client.data.user = payload;

      if (!userId) {
        client.disconnect(true);
        return;
      }

      this.connectedUsersService.registerConnection(userId, client.id, email || 'unknown');
      this.logger.log('Conexion exitosa - Usuario: ' + email + ' (ID: ' + userId + '), Socket: ' + client.id);
    } catch (error) {
      this.logger.error('Error en handleConnection', error);
      client.emit('connection_error', { message: 'Auth error' });
      client.disconnect(true);
    }
  }

  private extractTokenFromSocket(client: Socket): string | undefined {
    const authHeader = client.handshake.headers?.authorization as string | undefined;
    if (!authHeader) return undefined;
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') return parts[1];
    return undefined;
  }

  handleDisconnect(client: Socket) {
    try {
      const userId = client.data.userId;
      const email = client.data.email;
      const wasConnected = this.connectedUsersService.disconnectBySocket(client.id);
      if (wasConnected) {
        client.broadcast.emit('user_disconnected', {
          userId, email, disconnectedAt: new Date(),
          totalConnected: this.connectedUsersService.getTotalConnected(),
        });
      }
    } catch (error) {
      this.logger.error('Error en handleDisconnect', error);
    }
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket): { event: string; data: string } {
    return { event: 'pong', data: 'pong-' + new Date().getTime() };
  }

  @SubscribeMessage('get_connection_status')
  handleGetConnectionStatus(client: Socket) {
    const userId = client.data.userId;
    const connectionInfo = this.connectedUsersService.getConnectionInfo(userId);
    return {
      event: 'connection_status',
      data: { userId, socketId: client.id, isConnected: true, connectedAt: connectionInfo?.connectedAt || new Date() },
    };
  }

  notifyTransferSent(fromUserId: number, transactionData: { transactionId: number; amount: number; toEmail: string; newBalance: number; timestamp: Date }) {
    const socketIds = this.connectedUsersService.getSocketIds(fromUserId);
    for (const socketId of socketIds) {
      this.server.to(socketId).emit('transfer_sent', { message: 'Transferencia enviada', ...transactionData });
    }
  }

  notifyTransferReceived(toUserId: number, transactionData: { transactionId: number; amount: number; fromEmail: string; newBalance: number; timestamp: Date }) {
    const socketIds = this.connectedUsersService.getSocketIds(toUserId);
    for (const socketId of socketIds) {
      this.server.to(socketId).emit('transfer_received', { message: 'Has recibido una transferencia', ...transactionData });
    }
  }

  notifyTransfer(payload: { fromUserId: number; toUserId: number; amount: number; transactionId: number; newBalanceFrom: number; newBalanceTo: number; timestamp: Date }) {
    this.notifyTransferSent(payload.fromUserId, { transactionId: payload.transactionId, amount: payload.amount, toEmail: 'usuario', newBalance: payload.newBalanceFrom, timestamp: payload.timestamp });
    this.notifyTransferReceived(payload.toUserId, { transactionId: payload.transactionId, amount: payload.amount, fromEmail: 'usuario', newBalance: payload.newBalanceTo, timestamp: payload.timestamp });
  }

  sendNotificationToUser(userId: number, eventName: string, data: any) {
    const socketIds = this.connectedUsersService.getSocketIds(userId);
    for (const socketId of socketIds) {
      this.server.to(socketId).emit(eventName, data);
    }
  }

  isUserConnected(userId: number): boolean {
    return this.connectedUsersService.isConnected(userId);
  }
}
