import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

const VOICE_PREFIX = 'voice:room:';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class VoiceGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // socketId → roomId: para limpiar en disconnect
  private socketRoom = new Map<string, string>();

  @SubscribeMessage('voice:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ): void {
    const roomKey = `${VOICE_PREFIX}${roomId}`;

    // Peers ya presentes antes de que entre el nuevo
    const existing = this.server.sockets.adapter.rooms.get(roomKey);
    const peers = existing ? Array.from(existing) : [];

    client.join(roomKey);
    this.socketRoom.set(client.id, roomId);

    // Decirle al entrante quiénes hay ya en la sala
    client.emit('voice:peers', peers);

    // Notificar a los demás que llegó un peer nuevo
    client.to(roomKey).emit('voice:peer-joined', { peerId: client.id });
  }

  @SubscribeMessage('voice:offer')
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { to: string; offer: RTCSessionDescriptionInit },
  ): void {
    this.server
      .to(payload.to)
      .emit('voice:offer', { from: client.id, offer: payload.offer });
  }

  @SubscribeMessage('voice:answer')
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { to: string; answer: RTCSessionDescriptionInit },
  ): void {
    this.server
      .to(payload.to)
      .emit('voice:answer', { from: client.id, answer: payload.answer });
  }

  @SubscribeMessage('voice:ice-candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { to: string; candidate: RTCIceCandidateInit },
  ): void {
    this.server
      .to(payload.to)
      .emit('voice:ice-candidate', { from: client.id, candidate: payload.candidate });
  }

  @SubscribeMessage('voice:leave')
  handleLeave(@ConnectedSocket() client: Socket): void {
    this.leaveCurrentRoom(client);
  }

  handleDisconnect(client: Socket): void {
    this.leaveCurrentRoom(client);
  }

  private leaveCurrentRoom(client: Socket): void {
    const roomId = this.socketRoom.get(client.id);
    if (!roomId) return;
    const roomKey = `${VOICE_PREFIX}${roomId}`;
    client.to(roomKey).emit('voice:peer-left', { peerId: client.id });
    client.leave(roomKey);
    this.socketRoom.delete(client.id);
  }
}
